import { BaseActionContext } from "./StoryEngine";
import { applyMacros, collectMacros } from "./StoryMacro";
import type { ParseSeverity } from "./StoryNodeHelpers";
import {
  assignAddrs,
  BaseNode,
  cloneNode,
  findNodes,
  marshallText,
  parseXmlFragment,
  walkTree,
} from "./StoryNodeHelpers";
import {
  StoryCartridge,
  StoryNode,
  StorySource,
  VoiceSpec,
} from "./StoryTypes";
import { cleanSplit, isBlank } from "./TextHelpers";

export { parseXmlFragment } from "./StoryNodeHelpers";

export function processModuleIncludes(root: StoryNode): void {
  const modules = findNodes(root, (node) => node.type === "module").filter(
    (mod) => !isBlank(mod.atts.id)
  );
  if (modules.length === 0) return;
  walkTree(root, (node, parent, idx) => {
    if (parent && node.type === "include" && !isBlank(node.atts.id)) {
      const found = modules.find((mod) => mod.atts.id === node.atts.id);
      parent.kids.splice(idx, 1, ...(found?.kids.map(cloneNode) ?? []));
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
  ctx: BaseActionContext,
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
  processModuleIncludes(root);
  assignAddrs(root);

  const meta: Record<string, string> = {};
  findNodes(root, (node) => node.type === "meta").forEach((node) => {
    if (!isBlank(node.atts.description)) {
      meta[node.atts.name ?? node.atts.property] = node.atts.description;
      if (options.verbose) {
        console.info("Found <meta>", node.atts);
      }
    }
  });

  const pronunciations: Record<string, string> = {};
  findNodes(root, (node) => node.type === "pronunciation").forEach((node) => {
    if (!isBlank(node.atts.word) && !isBlank(node.atts.pronuncation)) {
      pronunciations[node.atts.word] = node.atts.pronuncation;
      if (options.verbose) {
        console.info("Found <pronunciation>", node.atts);
      }
    }
  });

  const voices: VoiceSpec[] = [];
  if (options.doCompileVoices && ctx.provider) {
    const voiceNodes = findNodes(root, (node) => node.type === "voice");
    for (let i = 0; i < voiceNodes.length; i++) {
      const node = voiceNodes[i];
      if (isBlank(node.atts.id)) {
        continue;
      }
      if (options.verbose) {
        console.info(`Generating voice ${node.atts.id}...`);
      }
      const text =
        node.atts.prompt ??
        node.atts.description ??
        (await marshallText(node, ctx));
      const { id } = await ctx.provider.generateVoice(text, {});
      voices.push({
        id,
        ref: node.atts.id.trim(),
        name: node.atts.name ?? id,
        tags: cleanSplit(node.atts.tags, ","),
      });
      if (options.verbose) {
        console.info(`Generated voice ${node.atts.id} ~> ${id}`);
      }
    }
  }

  return { root, voices, meta, pronunciations };
}
