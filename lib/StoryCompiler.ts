import { DOMParser } from "@xmldom/xmldom";
import { BaseActionContext } from "./StoryEngine";
import { BaseNode, findNodes, marshallText } from "./StoryNodeHelpers";
import {
  StoryCartridge,
  StoryNode,
  StorySource,
  VoiceSpec,
} from "./StoryTypes";
import { cleanSplit, isBlank } from "./TextHelpers";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
type ParseSeverity = "warning" | "error" | "fatal";

export const toAttrs = (el: Element): Record<string, string> => {
  const out: Record<string, string> = {};
  const a = el.attributes;
  for (let i = 0; a && i < a.length; i++) {
    const item = a.item(i);
    if (item) out[item.name] = item.value;
  }
  return out;
};

const fromDom = (n: Node): BaseNode =>
  n.nodeType === TEXT_NODE
    ? { type: "#text", atts: {}, kids: [], text: n.nodeValue ?? "" }
    : n.nodeType === ELEMENT_NODE
      ? {
          type: (n as Element).tagName,
          atts: toAttrs(n as Element),
          kids: Array.from(n.childNodes)
            .map((c, i) => fromDom(c))
            .filter(
              (child) =>
                child.type !== "#text" ||
                (child.text && child.text.trim() !== "")
            ),
          text: "",
        }
      : { type: `#${n.nodeName}`, atts: {}, kids: [], text: "" };

export function parseXmlFragment(
  frag: string,
  collect?: (severity: ParseSeverity, message: string) => void
): BaseNode {
  const parser = collect
    ? new DOMParser({
        locator: {},
        errorHandler: {
          warning: (msg: string) => collect("warning", msg),
          error: (msg: string) => collect("error", msg),
          fatalError: (msg: string) => collect("fatal", msg),
        },
      })
    : new DOMParser();
  const xml = `<root>${frag}</root>`;
  const doc = parser.parseFromString(xml, "text/xml");
  const root = doc.documentElement;
  return fromDom(root);
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
  let currentIndex = 0;
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
    const mappedKids = section.kids.map((child, idx) => {
      const childIndex = currentIndex + idx;
      return walkMap(
        child,
        (node, parent, index) => ({
          ...node,
          addr: parent ? `${parent.addr}.${index}` : `0.${childIndex}`,
          kids: node.kids as StoryNode[],
        }),
        { ...root, addr: "0" } as StoryNode,
        childIndex
      );
    });
    root.kids.push(...mappedKids);
    currentIndex += section.kids.length;
  }
  return root;
}

export async function compileStory(
  ctx: BaseActionContext,
  cartridge: StoryCartridge,
  options: CompileOptions
): Promise<StorySource> {
  const root = buildStoryRoot(cartridge, options.verbose);

  const meta: Record<string, string> = {};
  findNodes(root, (node) => node.type === "meta").forEach((node) => {
    if (!isBlank(node.atts.description)) {
      meta[node.atts.name ?? node.atts.property] = node.atts.description;
      if (options.verbose) {
        console.info("Found meta tag", meta);
      }
    }
  });

  const voices: VoiceSpec[] = [];
  if (options.doCompileVoices && ctx.provider) {
    const voiceNodes = findNodes(root, (node) => node.type === "compile:voice");
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

  return { root, voices, meta };
}
