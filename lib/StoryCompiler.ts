import { omit } from "lodash";
import { TSerial } from "../typings";
import { safeJsonParse, safeYamlParse } from "./JSONHelpers";
import { applyMacros, collectMacros, MacroDefinition } from "./StoryMacro";
import type { ParseSeverity } from "./StoryNodeHelpers";
import {
  assignAddrs,
  BaseNode,
  cloneNode,
  findNodes,
  parseXmlFragment,
  walkTree,
} from "./StoryNodeHelpers";
import { renderText } from "./StoryRenderMethods";
import {
  CompilerContext,
  NestedRecords,
  StoryCartridge,
  StoryNode,
  StorySource,
  VoiceSpec,
} from "./StoryTypes";
import { cleanSplit, isBlank, isPresent, snorm } from "./TextHelpers";
import { createWelltaleContent } from "./WelltaleKnowledgeContext";
export { parseXmlFragment } from "./StoryNodeHelpers";

const NON_INCLUDABLE_TAGS = ["include", "root", "html", "body", "macro"];

const COMPILE_TIME_TAGS = ["macro", "include"];

export function processIncludes(root: StoryNode): void {
  const moduleables = findNodes(
    root,
    (node) =>
      !NON_INCLUDABLE_TAGS.includes(node.type) &&
      !node.type.startsWith("#") &&
      node.kids.length > 0 &&
      !isBlank(node.atts.id)
  );
  if (moduleables.length === 0) return;

  // Pre-collect <include> tags so we don't end up in an infinite loop if modules include an <include>
  const includes: { node: StoryNode; parent: StoryNode; idx: number }[] = [];
  walkTree(root, (node, parent, idx) => {
    if (parent && node.type === "include" && !isBlank(node.atts.id)) {
      includes.push({ node, parent, idx });
    }
    return null;
  });

  for (let i = 0; i < includes.length; i++) {
    const { node, parent, idx } = includes[i];
    const found = moduleables.find((mod) => mod.atts.id === node.atts.id);
    parent.kids.splice(idx, 1, ...(found?.kids.map(cloneNode) ?? []));
  }
}

export function stripCompileTimeTags(root: StoryNode): void {
  walkTree(root, (node, parent, idx) => {
    if (parent && COMPILE_TIME_TAGS.includes(node.type)) {
      // Mark for removal by returning empty array
      return [];
    }
    return null;
  });

  // Remove marked nodes
  walkTree(root, (node, parent, idx) => {
    if (node.kids) {
      node.kids = node.kids.filter(
        (child) => !COMPILE_TIME_TAGS.includes(child.type)
      );
    }
    return null;
  });
}

export function walkMap<T extends BaseNode, S extends BaseNode>(
  node: T,
  mapper: (node: T, parent: S | null, index: number) => S,
  parent: S | null = null,
  index: number = 0
): S {
  const mappedNode = mapper({ ...node } as T, parent, index);
  const mappedKids = node.kids.map((child, i) =>
    walkMap(child as T, mapper, mappedNode, i)
  );
  mappedNode.kids = mappedKids;
  return mappedNode;
}

export type CompileOptions = {
  doCompileVoices: boolean;
  verbose?: boolean;
  failOnXmlError?: boolean;
};

async function buildStoryRoot(
  cartridge: StoryCartridge,
  context: CompilerContext,
  verbose: boolean | undefined,
  collect:
    | ((path: string, severity: ParseSeverity, message: string) => void)
    | undefined,
  externalMacros: MacroDefinition[]
): Promise<StoryNode> {
  const root: StoryNode = {
    addr: "0",
    type: "root",
    atts: {},
    kids: [],
    text: "",
  };
  function isMain(p: string) {
    return (
      p === "main.xml" ||
      p.endsWith("/main.xml") ||
      p.endsWith("\\main.xml") ||
      p === "main.wsl" ||
      p.endsWith("/main.wsl") ||
      p.endsWith("\\main.wsl")
    );
  }
  const all = Object.keys(cartridge).filter(
    (k) => k.endsWith(".xml") || k.endsWith(".wsl")
  );
  const mains = all.filter(isMain);
  const rest = all.filter((k) => !isMain(k));
  const keys = [...mains, ...rest];
  const collectedMacros: ReturnType<typeof collectMacros>["macros"] = [];
  const accumulatedNodes: BaseNode[] = [];
  for (let i = 0; i < keys.length; i++) {
    const path = keys[i];
    const content = cartridge[path].toString("utf-8");
    if (verbose) {
      console.info("Parsing", path);
    }
    const sectionCollect = collect
      ? (severity: ParseSeverity, message: string) =>
          collect(path, severity, message)
      : undefined;
    const section = parseXmlFragment(content, sectionCollect);
    const expanded = await expandCreateNodes(
      section.kids,
      context,
      sectionCollect,
      verbose,
      path
    );
    const { nodes, macros } = collectMacros(expanded, "macro");
    collectedMacros.push(...macros);
    accumulatedNodes.push(...nodes);
  }
  if (externalMacros.length > 0) {
    collectedMacros.push(...externalMacros);
  }
  const transformed = applyMacros(accumulatedNodes, collectedMacros);
  for (let i = 0; i < transformed.length; i++) {
    const mapped = walkMap(
      transformed[i],
      (node, parent, index) => ({
        ...node,
        addr: parent ? `${parent.addr}.${index}` : `0.${i}`,
        kids: node.kids as StoryNode[],
      }),
      { ...root, addr: "0" } as StoryNode,
      i
    );
    root.kids.push(mapped);
  }
  return root;
}

export async function compileStory(
  context: CompilerContext,
  cartridge: StoryCartridge,
  options: CompileOptions
): Promise<StorySource> {
  const collect = options.failOnXmlError
    ? (path: string, severity: ParseSeverity, message: string) => {
        if (severity === "warning") {
          console.warn(`XML ${severity} in ${path}: ${message}`);
          return;
        }
        throw new Error(`XML ${severity} in ${path}: ${message}`);
      }
    : undefined;

  const jsons: unknown[] = Object.keys(cartridge)
    .filter((k) => k.endsWith(".json"))
    .map((key) => safeJsonParse(cartridge[key].toString()))
    .filter(isPresent) as unknown[];

  const yamls: unknown[] = Object.keys(cartridge)
    .filter((k) => k.endsWith(".yml") || k.endsWith(".yaml"))
    .map((key) => safeYamlParse(cartridge[key].toString()))
    .filter(isPresent) as unknown[];

  const dataDocs: unknown[] = [...jsons, ...yamls];
  const dataArtifacts = collectDataArtifacts(dataDocs);

  const root = await buildStoryRoot(
    cartridge,
    context,
    options.verbose,
    collect,
    dataArtifacts.macros
  );
  processIncludes(root);
  assignAddrs(root);

  const pronunciations: Record<string, string> = {
    ...dataArtifacts.pronunciations,
  };
  const voices: Record<string, VoiceSpec> = { ...dataArtifacts.readyVoices };
  const meta: Record<string, TSerial> = { ...dataArtifacts.meta };
  const scripts: NestedRecords = {};
  const outputs: StorySource = {
    scripts,
    pronunciations,
    voices,
    meta,
    root,
  };
  // Provide interpolation service to the metadata itself
  const metaStr = JSON.stringify(meta);
  Object.assign(context.scope, meta); // Provide meta's own variables
  const renderedMetaStr = await renderText(metaStr, context);
  const renderedMeta = safeJsonParse(renderedMetaStr);
  if (renderedMeta) {
    Object.assign(context.scope, renderedMeta);
  }

  Object.keys(cartridge)
    .filter((k) => k.endsWith(".ts") || k.endsWith(".js"))
    .forEach((key) => {
      const src = cartridge[key];
      const parts = key.split("/");
      let cur = scripts;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!cur[part] || typeof cur[part] !== "object") {
          cur[part] = {};
        }
        cur = cur[part] as NestedRecords;
      }
      const last = parts[parts.length - 1];
      cur[last] = src.toString();
    });

  if (options.doCompileVoices) {
    await compilePendingDataVoices(
      dataArtifacts.pendingVoices,
      voices,
      context,
      options.verbose
    );
  } else if (dataArtifacts.pendingVoices.length > 0) {
    console.warn(
      "Skipping data voice prompts because voice compilation is disabled"
    );
  }

  // Strip compile-time tags from the tree after processing them
  stripCompileTimeTags(root);

  console.info("Compiled", omit(outputs, "root"));

  return outputs;
}

async function expandCreateNodes(
  nodes: BaseNode[],
  context: CompilerContext,
  collect: ((severity: ParseSeverity, message: string) => void) | undefined,
  verbose: boolean | undefined,
  source: string
): Promise<BaseNode[]> {
  const out: BaseNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "create") {
      const raw = collectText(node);
      const prompt = (await renderText(raw, context)).trim();
      if (!prompt) {
        console.warn(`Skipping <create> in ${source} with empty prompt`);
        continue;
      }
      if (verbose) {
        console.info(`Generating <create> content in ${source}`);
      }
      const generated = await createWelltaleContent(prompt, context.provider, {
        ...context.options,
        useWebSearch: false,
      });
      const fragment = parseXmlFragment(generated, collect);
      const kids = await expandCreateNodes(
        fragment.kids,
        context,
        collect,
        verbose,
        source
      );
      out.push(...kids);
      continue;
    }
    if (!node.kids.length) {
      out.push({
        type: node.type,
        atts: { ...node.atts },
        kids: [],
        text: node.text,
      });
      continue;
    }
    const kids = await expandCreateNodes(
      node.kids,
      context,
      collect,
      verbose,
      source
    );
    out.push({
      type: node.type,
      atts: { ...node.atts },
      kids,
      text: node.text,
    });
  }
  return out;
}

type PendingDataVoice = {
  ref: string;
  prompt: string;
  name: string | null;
  tags: string[];
};

type DataArtifacts = {
  macros: MacroDefinition[];
  pronunciations: Record<string, string>;
  meta: Record<string, TSerial>;
  readyVoices: Record<string, VoiceSpec>;
  pendingVoices: PendingDataVoice[];
};

async function compilePendingDataVoices(
  pending: PendingDataVoice[],
  voices: Record<string, VoiceSpec>,
  context: CompilerContext,
  verbose: boolean | undefined
): Promise<void> {
  for (let i = 0; i < pending.length; i++) {
    const voice = pending[i];
    const prompt = snorm(await renderText(voice.prompt, context));
    if (isBlank(prompt)) {
      console.warn(`Skipping data voice ${voice.ref} with empty prompt`);
      continue;
    }
    if (verbose) {
      console.info(`Generating voice ${voice.ref}...`);
    }
    const { id } = await context.provider.generateVoice(prompt, {});
    voices[id] = {
      id,
      ref: voice.ref,
      name: voice.name ?? id,
      tags: voice.tags,
    };
  }
}

function collectDataArtifacts(entries: unknown[]): DataArtifacts {
  const macros: MacroDefinition[] = [];
  const pronunciations: Record<string, string> = {};
  const meta: Record<string, TSerial> = {};
  const readyVoices: Record<string, VoiceSpec> = {};
  const pendingVoices: PendingDataVoice[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!isRecord(entry)) {
      continue;
    }
    const macroSource = entry["macros"];
    if (Array.isArray(macroSource)) {
      for (let j = 0; j < macroSource.length; j++) {
        const parsed = toMacroDefinition(macroSource[j]);
        if (parsed) {
          macros.push(parsed);
        }
      }
    }
    const voiceSource = entry["voices"];
    if (isRecord(voiceSource)) {
      const voiceKeys = Object.keys(voiceSource);
      for (let j = 0; j < voiceKeys.length; j++) {
        const key = voiceKeys[j];
        const value = voiceSource[key];
        const spec = toVoiceSpec(value, key);
        if (spec) {
          readyVoices[key] = spec;
          continue;
        }
        const pending = toPendingVoice(value, key);
        if (pending) {
          pendingVoices.push(pending);
          continue;
        }
        console.warn(`Ignoring voice ${key} with invalid data`);
      }
    }
    const pronunciationsSource = entry["pronunciations"];
    if (isRecord(pronunciationsSource)) {
      const pronKeys = Object.keys(pronunciationsSource);
      for (let j = 0; j < pronKeys.length; j++) {
        const key = pronKeys[j];
        const value = toStringValue(pronunciationsSource[key]);
        if (value !== null) {
          pronunciations[key] = value;
        }
      }
    }
    const keys = Object.keys(entry);
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j];
      if (key === "pronunciations" || key === "voices" || key === "macros") {
        continue;
      }
      const value = entry[key];
      if (value !== undefined) {
        meta[key] = value as TSerial;
      }
    }
  }
  return { macros, pronunciations, meta, readyVoices, pendingVoices };
}

function collectText(node: BaseNode): string {
  if (node.type === "#text") {
    return node.text;
  }
  let out = "";
  for (let i = 0; i < node.kids.length; i++) {
    out += collectText(node.kids[i]);
  }
  return out;
}

function toMacroDefinition(source: unknown): MacroDefinition | null {
  if (!isRecord(source)) {
    console.warn("Ignoring macro without object data");
    return null;
  }
  const match = toNonEmptyString(source["match"]);
  if (!match) {
    console.warn("Ignoring macro without match selector");
    return null;
  }
  const node = createNode("macro", { match });
  const id = toNonEmptyString(source["id"]);
  if (id) {
    node.atts.id = id;
  }
  const keys = Object.keys(source);
  const kids: BaseNode[] = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key === "match" || key === "id") {
      continue;
    }
    if (key === "rename") {
      kids.push(...buildRenameNodes(source[key]));
      continue;
    }
    if (key === "set") {
      kids.push(...buildSetNodes(source[key]));
      continue;
    }
    if (key === "remove") {
      kids.push(...buildRemoveNodes(source[key]));
      continue;
    }
    console.warn(`Unsupported macro operation in data: ${key}`);
  }
  node.kids = kids;
  const parsed = collectMacros([node], "macro").macros;
  if (!parsed.length) {
    return null;
  }
  return parsed[0];
}

function toVoiceSpec(source: unknown, key: string): VoiceSpec | null {
  if (!isRecord(source)) {
    return null;
  }
  const id = toNonEmptyString(source["id"]);
  if (!id) {
    return null;
  }
  const ref = toNonEmptyString(source["ref"]) ?? key;
  const name = toNonEmptyString(source["name"]) ?? id;
  const tags = toStringArray(source["tags"]);
  return { id, ref, name, tags };
}

function toPendingVoice(source: unknown, key: string): PendingDataVoice | null {
  if (!isRecord(source)) {
    return null;
  }
  const prompt =
    toNonEmptyString(source["prompt"]) ??
    toNonEmptyString(source["description"]);
  if (!prompt) {
    return null;
  }
  const ref = toNonEmptyString(source["ref"]) ?? key;
  const name = toNonEmptyString(source["name"]);
  const tags = toStringArray(source["tags"]);
  return { ref, prompt, name, tags };
}

function buildRenameNodes(value: unknown): BaseNode[] {
  const direct = toNonEmptyString(value);
  if (direct) {
    return [createNode("rename", { to: direct })];
  }
  if (!isRecord(value)) {
    console.warn("Ignoring rename macro with invalid data");
    return [];
  }
  const target = toNonEmptyString(value["to"]);
  if (!target) {
    console.warn("Ignoring rename macro without target");
    return [];
  }
  return [createNode("rename", { to: target })];
}

function buildSetNodes(value: unknown): BaseNode[] {
  if (Array.isArray(value)) {
    const nodes: BaseNode[] = [];
    for (let i = 0; i < value.length; i++) {
      nodes.push(...buildSetNodes(value[i]));
    }
    return nodes;
  }
  if (!isRecord(value)) {
    console.warn("Ignoring set macro with invalid data");
    return [];
  }
  const nodes: BaseNode[] = [];
  const hasAttrKey = Object.prototype.hasOwnProperty.call(value, "attr");
  const hasValueKey = Object.prototype.hasOwnProperty.call(value, "value");
  if (hasAttrKey || hasValueKey) {
    const attr = toNonEmptyString(value["attr"]);
    const val = toStringValue(value["value"]);
    if (attr && val !== null) {
      nodes.push(createNode("set", { attr, value: val }));
    } else {
      console.warn("Ignoring set macro without attr or value");
    }
  }
  if (Object.prototype.hasOwnProperty.call(value, "attrs")) {
    nodes.push(...buildSetNodes(value["attrs"]));
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key === "attr" || key === "value" || key === "attrs") {
      continue;
    }
    const val = toStringValue(value[key]);
    if (val === null) {
      console.warn(`Ignoring set macro value for ${key}`);
      continue;
    }
    nodes.push(createNode("set", { attr: key, value: val }));
  }
  return nodes;
}

function buildRemoveNodes(value: unknown): BaseNode[] {
  if (Array.isArray(value)) {
    const nodes: BaseNode[] = [];
    for (let i = 0; i < value.length; i++) {
      nodes.push(...buildRemoveNodes(value[i]));
    }
    return nodes;
  }
  const attr = toNonEmptyString(value);
  if (attr) {
    return [createNode("remove", { attr })];
  }
  if (!isRecord(value)) {
    console.warn("Ignoring remove macro with invalid data");
    return [];
  }
  const target = toNonEmptyString(value["attr"]);
  if (!target) {
    console.warn("Ignoring remove macro without attr");
    return [];
  }
  return [createNode("remove", { attr: target })];
}

function createNode(type: string, atts: Record<string, string>): BaseNode {
  return {
    type,
    atts,
    kids: [],
    text: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function toNonEmptyString(value: unknown): string | null {
  const str = toStringValue(value);
  if (str === null) {
    return null;
  }
  const trimmed = str.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const entry = toNonEmptyString(value[i]);
      if (entry) {
        out.push(entry);
      }
    }
    return out;
  }
  const str = toNonEmptyString(value);
  if (!str) {
    return [];
  }
  return cleanSplit(str, ",");
}
