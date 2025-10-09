import { omit } from "lodash";
import { TSerial } from "../typings";
import { safeJsonParse, safeYamlParse } from "./JSONHelpers";
import { applyMacros, collectMacros } from "./StoryMacro";
import type { ParseSeverity } from "./StoryNodeHelpers";
import {
  assignAddrs,
  BaseNode,
  cloneNode,
  collateText,
  findNodes,
  parseXmlFragment,
  walkTree,
} from "./StoryNodeHelpers";
import { renderText } from "./StoryRenderMethods";
import {
  BaseActionContext,
  NestedRecords,
  StoryCartridge,
  StoryNode,
  StorySource,
  VoiceSpec,
} from "./StoryTypes";
import { cleanSplit, isBlank, isPresent, snorm } from "./TextHelpers";
export { parseXmlFragment } from "./StoryNodeHelpers";

const NON_INCLUDABLE_TAGS = ["include", "root", "html", "body", "macro"];

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

function buildStoryRoot(
  cartridge: StoryCartridge,
  verbose: boolean | undefined,
  collect?: (path: string, severity: ParseSeverity, message: string) => void
): StoryNode {
  const root: StoryNode = {
    addr: "0",
    type: "root",
    atts: {},
    kids: [],
    text: "",
  };
  function isMain(p: string) {
    return (
      p === "main.xml" || p.endsWith("/main.xml") || p.endsWith("\\main.xml")
    );
  }
  const all = Object.keys(cartridge).filter((k) => k.endsWith(".xml"));
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
    const section = parseXmlFragment(
      content,
      collect
        ? (severity, message) => collect(path, severity, message)
        : undefined
    );
    const { nodes, macros } = collectMacros(section.kids, "macro");
    collectedMacros.push(...macros);
    accumulatedNodes.push(...nodes);
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
  context: BaseActionContext,
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

  const root = buildStoryRoot(cartridge, options.verbose, collect);
  processIncludes(root);
  assignAddrs(root);

  const pronunciations: Record<string, string> = {};
  const voices: Record<string, VoiceSpec> = {};
  const meta: Record<string, TSerial> = {};
  const scripts: NestedRecords = {};
  const outputs: StorySource = {
    scripts,
    pronunciations,
    voices,
    meta,
    root,
  };

  const jsons = Object.keys(cartridge)
    .filter((k) => k.endsWith(".json"))
    .map((key) => safeJsonParse(cartridge[key].toString()))
    .filter(isPresent);

  const yamls = Object.keys(cartridge)
    .filter((k) => k.endsWith(".yml") || k.endsWith(".yaml"))
    .map((key) => safeYamlParse(cartridge[key].toString()))
    .filter(isPresent);

  [...jsons, ...yamls].forEach((data) => {
    if (!data || typeof data !== "object") {
      return;
    }
    if (data.pronunciations) {
      Object.assign(pronunciations, data.pronunciations);
    }
    if (data.voices) {
      Object.assign(voices, data.voices);
    }
    Object.assign(meta, omit(data, "pronunciations", "voices"));
  });

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

  const metaNodes = findNodes(root, (node) => node.type === "meta");
  for (let i = 0; i < metaNodes.length; i++) {
    const node = metaNodes[i];
    if (!isBlank(node.atts.description)) {
      outputs.meta[node.atts.name ?? node.atts.property] = await renderText(
        node.atts.description,
        context
      );
      if (options.verbose) {
        console.info("Found <meta>", node.atts);
      }
    }
  }

  const pronunciationNodes = findNodes(
    root,
    (node) => node.type === "pronunciation"
  );
  for (let i = 0; i < pronunciationNodes.length; i++) {
    const node = pronunciationNodes[i];
    if (!isBlank(node.atts.word) && !isBlank(node.atts.pronunciation)) {
      pronunciations[node.atts.word] = await renderText(
        node.atts.pronunciation,
        context
      );
      if (options.verbose) {
        console.info("Found <pronunciation>", node.atts);
      }
    }
  }

  if (options.doCompileVoices) {
    const voiceNodes = findNodes(root, (node) => node.type === "voice");
    for (let i = 0; i < voiceNodes.length; i++) {
      const node = voiceNodes[i];
      if (isBlank(node.atts.id)) {
        continue;
      }
      const text = snorm(
        await renderText(
          node.atts.prompt ??
            node.atts.description ??
            (await collateText(node)),
          context
        )
      );
      if (!isBlank(text)) {
        if (options.verbose) {
          console.info(`Generating voice ${node.atts.id}...`);
        }
        const { id } = await context.provider.generateVoice(text, {});
        voices[id] = {
          id,
          ref: node.atts.id,
          name: node.atts.name ?? id,
          tags: cleanSplit(node.atts.tags, ","),
        };
      } else {
        if (options.verbose) {
          console.info(`Found <voice> ${node.atts.id}`);
        }
        voices[node.atts.id] = {
          id: node.atts.id,
          ref: node.atts.ref ?? node.atts.id,
          name: node.atts.name ?? node.atts.id,
          tags: cleanSplit(node.atts.tags, ","),
        };
      }
    }
  }

  console.info("Compiled", omit(outputs, "root"));

  return outputs;
}
