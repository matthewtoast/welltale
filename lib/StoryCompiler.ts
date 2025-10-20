import { omit, uniq } from "lodash";
import { TSerial } from "../typings";
import { autoFindVoiceId } from "./ElevenLabsUtils";
import { ELEVENLABS_PRESET_VOICES } from "./ElevenLabsVoices";
import { safeJsonParse } from "./JSONHelpers";
import { collectDataArtifacts, collectDataDocs } from "./StoryConstants";
import type { ParseSeverity } from "./StoryNodeHelpers";
import { assignAddrs, BaseNode, parseXmlFragment } from "./StoryNodeHelpers";
import { renderText } from "./StoryRenderMethods";
import {
  CompilerContext,
  ImageModelSlug,
  NestedRecords,
  PendingDataVoice,
  StoryCartridge,
  StoryNode,
  StorySource,
  VoiceSpec,
} from "./StoryTypes";
import { isBlank, keywordize, snorm } from "./TextHelpers";
export { parseXmlFragment } from "./StoryNodeHelpers";

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
  doGenerateThumbnails: boolean;
};

const THUMBNAIL_IMAGE_MODEL: ImageModelSlug =
  "google/gemini-2.5-flash-image-preview";

function isUrlValue(value: string) {
  return /^https?:\/\//i.test(value);
}

function isPromptValue(value: string) {
  if (!value) {
    return false;
  }
  if (isUrlValue(value)) {
    return false;
  }
  return !/^[\w-]+$/.test(value);
}

function metaTextValue(value: TSerial) {
  if (typeof value !== "string") {
    return "";
  }
  return snorm(value);
}

function buildThumbnailPrompt(meta: Record<string, TSerial>, current: string) {
  const candidate = snorm(current || "");
  if (isPromptValue(candidate)) {
    return candidate;
  }
  const title = metaTextValue(meta.title ?? "");
  const description = metaTextValue(meta.description ?? "");
  if (!title && !description) {
    return "";
  }
  if (!title) {
    return `Cover art inspired by: ${description}`;
  }
  if (!description) {
    return `Cover art for interactive audio story "${title}"`;
  }
  return `Cover art for interactive audio story "${title}". Focus on: ${description}`;
}

async function ensureThumbnail(
  meta: Record<string, TSerial>,
  context: CompilerContext
) {
  const raw = typeof meta.thumbnail === "string" ? meta.thumbnail : "";
  const trimmed = snorm(raw || "");
  if (trimmed && isUrlValue(trimmed)) {
    return;
  }
  const prompt = buildThumbnailPrompt(meta, raw);
  if (!prompt) {
    return;
  }
  try {
    const result = await context.provider.generateImage(prompt, {
      model: THUMBNAIL_IMAGE_MODEL,
    });
    if (!result.url) {
      console.warn("Generated thumbnail missing url");
      return;
    }
    meta.thumbnail = result.url;
  } catch (e) {
    console.error(e);
  }
}

async function buildStoryRoot(
  cartridge: StoryCartridge,
  context: CompilerContext,
  verbose: boolean | undefined,
  collect:
    | ((path: string, severity: ParseSeverity, message: string) => void)
    | undefined
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
    accumulatedNodes.push(...expanded);
  }
  const transformed = accumulatedNodes;
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

  const dataDocs = collectDataDocs(cartridge);
  const dataArtifacts = collectDataArtifacts(dataDocs);

  const root = await buildStoryRoot(
    cartridge,
    context,
    options.verbose,
    collect
  );
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
    Object.assign(meta, renderedMeta);
  }

  if (options.doGenerateThumbnails) {
    await ensureThumbnail(meta, context);
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
  } else {
    assignPendingVoices(
      dataArtifacts.pendingVoices,
      voices,
      ELEVENLABS_PRESET_VOICES
    );
  }

  if (dataArtifacts.pendingVoices.length > 0) {
    console.warn(
      "Skipping data voice prompts because voice compilation is disabled"
    );
  }

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
    try {
      const { id } = await context.provider.generateVoice(prompt, {});
      voices[id] = {
        id,
        ref: voice.ref,
        name: voice.name ?? id,
        tags: voice.tags,
      };
    } catch (e) {
      console.error(e);
      continue;
    }
  }
}

// Assign each of the given pending voices an id, without repeating ids.
export function assignPendingVoices(
  pendingVoices: PendingDataVoice[],
  voicesToAssign: Record<string, VoiceSpec>,
  voicesToSearch: VoiceSpec[]
) {
  const voice = pendingVoices.shift();
  if (!voice) {
    return;
  }
  const terms = uniq([...keywordize(voice.prompt), ...voice.tags]);
  const id = autoFindVoiceId(
    {
      voice: voice.name,
      speaker: voice.name,
      tags: terms,
    },
    voicesToSearch
  );
  voicesToAssign[id] = {
    id,
    ref: voice.ref,
    name: voice.name ?? id,
    tags: voice.tags,
  };
  const voicesToSearchWithout = voicesToSearch.filter((v) => v.id !== id);
  assignPendingVoices(pendingVoices, voicesToAssign, voicesToSearchWithout);
}
