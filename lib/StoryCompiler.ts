import * as parse5 from "parse5";
import { Cartridge } from "./StoryEngine";

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

const build = (n: any, parent: Node | null, o: BuildOpts): Node => {
  const tag = tagOf(n);
  const text = isText(n) ? n.value : "";
  const atts = isElem(n) ? attrs(n) : {};
  const node: Node = { tag, atts, kids: [], text };
  if (isParent(n)) {
    const rawKids = n.childNodes as any[];
    const filtered = o.skipWhitespace
      ? rawKids.filter((k) => !(isText(k) && k.value.trim() === ""))
      : rawKids;
    node.kids = filtered.map((k) => build(k, node, o));
  }
  return node;
};

export const fromFragment = (
  html: string,
  o: BuildOpts = { skipWhitespace: true }
) => build(parse5.parseFragment(html), null, o);

export type Section = {
  path: string;
  root: Node;
};

export type Node = {
  tag: string;
  atts: Record<string, string>;
  kids: Node[];
  text: string;
};

export async function compile(cartridge: Cartridge) {
  const sources: Section[] = [];
  for (let path in cartridge) {
    const content = cartridge[path];
    if (path.endsWith(".xml")) {
      const root = fromFragment(content.toString("utf-8"));
      sources.push({ path, root });
    }
  }
  return sources;
}
export function dumpTree(node: Node, indent = ""): string {
  const lines: string[] = [];

  // Build attributes string
  const attrPairs = Object.entries(node.atts)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  const attrString = attrPairs ? ` ${attrPairs}` : "";

  // Helper to render id only if present
  const idString = node.atts.id ? ` id="${node.atts.id}"` : "";

  // For text nodes, show their content inline
  if (node.tag === TEXT_TAG) {
    const textContent = node.text?.trim();
    if (textContent) {
      lines.push(
        `${indent}<${node.tag}${idString}>${textContent}</${node.tag}>`
      );
    } else {
      lines.push(`${indent}<${node.tag}${idString} />`);
    }
    return lines.join("\n");
  }

  // Get direct text content (from text children only)
  const directTextContent = node.kids
    .filter((k) => k.tag === TEXT_TAG)
    .map((k) => k.text?.trim())
    .filter(Boolean)
    .join("");

  const hasNonTextChildren = node.kids.some((k) => k.tag !== TEXT_TAG);

  if (!hasNonTextChildren && directTextContent) {
    // Leaf node with text content
    lines.push(
      `${indent}<${node.tag}${idString}${attrString}>${directTextContent}</${node.tag}>`
    );
  } else if (node.kids.length === 0) {
    // Self-closing tag
    lines.push(`${indent}<${node.tag}${idString}${attrString} />`);
  } else {
    // Tag with children
    lines.push(`${indent}<${node.tag}${idString}${attrString}>`);

    // Add children
    for (const child of node.kids) {
      lines.push(dumpTree(child, indent + "  "));
    }

    lines.push(`${indent}</${node.tag}>`);
  }

  return lines.join("\n");
}

export function dumpTreeCompact(node: Node): string {
  const result = dumpTree(node);
  // Remove empty lines
  return result
    .split("\n")
    .filter((line) => line.trim())
    .join("\n");
}
