import { DOMParser } from "@xmldom/xmldom";
import * as parse5 from "parse5";
import { Cartridge } from "./StoryEngine";

export type StoryNode = {
  addr: string; // a tree locator string like "0.2.1"
  type: string; // the tag name, e.g. p, block, #text, whatever
  atts: Record<string, string>; // the element attributes
  kids: StoryNode[]; // its children (can be empty array)
  text: string; // its text value (can be empty string)
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export const toAttrs = (el: Element): Record<string, string> => {
  const out: Record<string, string> = {};
  const a: any = (el as any).attributes;
  for (let i = 0; a && i < a.length; i++) {
    const item = a.item(i);
    if (item) out[item.name] = item.value;
  }
  return out;
};

const fromDom = (n: Node, addr: string): StoryNode =>
  n.nodeType === TEXT_NODE
    ? { addr, type: "#text", atts: {}, kids: [], text: n.nodeValue ?? "" }
    : n.nodeType === ELEMENT_NODE
      ? {
          addr,
          type: (n as Element).tagName,
          atts: toAttrs(n as Element),
          kids: Array.from(n.childNodes)
            .map((c, i) => fromDom(c, `${addr}.${i}`))
            .filter(
              (child) =>
                child.type !== "#text" ||
                (child.text && child.text.trim() !== "")
            ),
          text: "",
        }
      : { addr, type: `#${n.nodeName}`, atts: {}, kids: [], text: "" };

export const parseXmlFragment = (frag: string): StoryNode => {
  const xml = `<root>${frag}</root>`;
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const root = doc.documentElement;
  return fromDom(root, "0");
};

export const TEXT_TAG = "#text";
export const FRAG_TAG = "#fragment";

type BuildOpts = { skipWhitespace?: boolean };
const gid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const isText = (n: any): n is parse5.DefaultTreeAdapterTypes.TextNode =>
  n.nodeName === TEXT_TAG;

const isParent = (n: any): n is parse5.DefaultTreeAdapterTypes.ParentNode =>
  Array.isArray((n as any).childNodes);

const isElem = (n: any): n is parse5.DefaultTreeAdapterTypes.Element =>
  !!(n as any).tagName;

const attrs = (n: parse5.DefaultTreeAdapterTypes.Element) =>
  Object.fromEntries(n.attrs.map((a) => [a.name, a.value]));

const tagOf = (n: any) =>
  isElem(n)
    ? n.tagName
    : n.nodeName === "#document"
      ? "#document"
      : n.nodeName === "#document-fragment"
        ? FRAG_TAG
        : n.nodeName;

const build = (
  n: any,
  i: number,
  parent: StoryNode | null,
  o: BuildOpts
): StoryNode => {
  const tag = tagOf(n);
  const text = isText(n) ? n.value : "";
  const atts = isElem(n) ? attrs(n) : {};
  const addr = parent ? `${parent.addr}.${i}` : `${i}`;
  const node: StoryNode = { addr, type: tag, atts, kids: [], text };
  if (isParent(n)) {
    const rawKids = n.childNodes as any[];
    const filtered = o.skipWhitespace
      ? rawKids.filter((k) => !(isText(k) && k.value.trim() === ""))
      : rawKids;
    node.kids = filtered.map((k, i) => build(k, i, node, o));
  }
  return node;
};

export const fromFragment = (
  html: string,
  o: BuildOpts = { skipWhitespace: true }
) => build(parse5.parseFragment(html), 0, null, o);

export type Section = {
  path: string;
  root: StoryNode;
};

export async function compile(cartridge: Cartridge) {
  const sources: Section[] = [];
  for (let path in cartridge) {
    const content = cartridge[path];
    if (path.endsWith(".xml")) {
      const root = parseXmlFragment(content.toString("utf-8"));
      sources.push({ path, root });
    }
  }
  return sources;
}
export function dumpTree(node: StoryNode | null, indent = ""): string {
  if (!node) {
    return "";
  }

  const lines: string[] = [];

  // Build attributes string
  const attrPairs = Object.entries(node.atts)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  const attrString = attrPairs ? ` ${attrPairs}` : "";

  // Helper to render id only if present
  const idString = node.atts.id ? ` id="${node.atts.id}"` : "";

  // For text nodes, show their content inline
  if (node.type === TEXT_TAG) {
    const textContent = node.text?.trim();
    if (textContent) {
      lines.push(
        `${indent}<${node.type}${idString}>${textContent}</${node.type}>`
      );
    } else {
      lines.push(`${indent}<${node.type}${idString} />`);
    }
    return lines.join("\n");
  }

  // Get direct text content (from text children only)
  const directTextContent = node.kids
    .filter((k) => k.type === TEXT_TAG)
    .map((k) => k.text?.trim())
    .filter(Boolean)
    .join("");

  const hasNonTextChildren = node.kids.some((k) => k.type !== TEXT_TAG);

  if (!hasNonTextChildren && directTextContent) {
    // Leaf node with text content
    lines.push(
      `${indent}<${node.type}${idString}${attrString}>${directTextContent}</${node.type}>`
    );
  } else if (node.kids.length === 0) {
    // Self-closing tag
    lines.push(`${indent}<${node.type}${idString}${attrString} />`);
  } else {
    // Tag with children
    lines.push(`${indent}<${node.type}${idString}${attrString}>`);

    // Add children
    for (const child of node.kids) {
      lines.push(dumpTree(child, indent + "  "));
    }

    lines.push(`${indent}</${node.type}>`);
  }

  return lines.join("\n");
}

export function dumpTreeCompact(node: StoryNode): string {
  const result = dumpTree(node);
  // Remove empty lines
  return result
    .split("\n")
    .filter((line) => line.trim())
    .join("\n");
}
