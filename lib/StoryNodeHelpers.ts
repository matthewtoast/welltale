import { DOMParser } from "@xmldom/xmldom";
import { BaseActionContext, renderAtts } from "./StoryEngine";
import { StoryNode } from "./StoryTypes";
import { isBlank, smoosh, snorm } from "./TextHelpers";

export const TEXT_TAG = "#text";

export type BaseNode = {
  type: string;
  atts: Record<string, string>;
  kids: BaseNode[];
  text: string;
};

export const TEXT_CONTENT_TAGS = [
  TEXT_TAG,
  "text",
  "p",
  "span",
  "b",
  "strong",
  "em",
  "i",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

export const DESCENDABLE_TAGS = [
  "root",
  "html",
  "body",
  "div",
  "ul",
  "ol",
  "li",
  "section",
  "sec",
  "pre",
  "scope",
  "origin",
  // Common HTML tags we'll treat as playable content
  "main",
  "aside",
  "article",
  "details",
  "summary",
];

const BLOCK_ELEMENTS = new Set([
  "p",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "figcaption",
  "dt",
  "dd",
]);

const SKIP_ELEMENTS = new Set([
  "script",
  "style",
  "noscript",
  "nav",
  "header",
  "footer",
  "svg",
  "iframe",
]);

const LINE_ELEMENTS = new Set(["br", "hr"]);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export type ParseSeverity = "warning" | "error" | "fatal";

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
    ? { type: TEXT_TAG, atts: {}, kids: [], text: n.nodeValue ?? "" }
    : n.nodeType === ELEMENT_NODE
      ? {
          type: (n as Element).tagName,
          atts: toAttrs(n as Element),
          kids: Array.from(n.childNodes)
            .map((c) => fromDom(c))
            .filter(
              (child) =>
                child.type !== TEXT_TAG ||
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

function textFromNode(node: BaseNode): string {
  if (node.type === TEXT_TAG) {
    return node.text;
  }
  if (SKIP_ELEMENTS.has(node.type)) {
    return "";
  }
  if (LINE_ELEMENTS.has(node.type)) {
    return "\n";
  }
  let out = "";
  for (let i = 0; i < node.kids.length; i++) {
    out += textFromNode(node.kids[i]);
  }
  return out;
}

function collectBlockNodes(node: BaseNode, acc: string[]): void {
  if (node.type === TEXT_TAG) {
    return;
  }
  if (SKIP_ELEMENTS.has(node.type)) {
    return;
  }
  if (BLOCK_ELEMENTS.has(node.type)) {
    const raw = textFromNode(node);
    const normalized = snorm(raw);
    if (normalized) {
      acc.push(normalized);
    }
    return;
  }
  for (let i = 0; i < node.kids.length; i++) {
    collectBlockNodes(node.kids[i], acc);
  }
}

export function extractReadableBlocks(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) {
    return [];
  }
  const root = parseXmlFragment(trimmed);
  const acc: string[] = [];
  for (let i = 0; i < root.kids.length; i++) {
    const child = root.kids[i];
    if (child.type === TEXT_TAG) {
      const normalized = snorm(child.text);
      if (normalized) {
        acc.push(normalized);
      }
      continue;
    }
    collectBlockNodes(child, acc);
  }
  return acc.map((entry) => smoosh(entry));
}

export function walkTree<T>(
  node: StoryNode,
  visitor: (
    node: StoryNode,
    parent: StoryNode | null,
    index: number
  ) => T | null,
  parent: StoryNode | null = null,
  index: number = 0
): T | null {
  const result = visitor(node, parent, index);
  if (result !== null && result !== undefined) return result;
  for (let i = 0; i < node.kids.length; i++) {
    const childResult = walkTree(node.kids[i], visitor, node, i);
    if (childResult !== null && childResult !== undefined) return childResult;
  }
  return null;
}

export function searchForNode(
  root: StoryNode,
  term: string | null | undefined
): { node: StoryNode } | null {
  if (!term || isBlank(term)) {
    return null;
  }
  const found = walkTree(root, (node) => (node.atts.id === term ? node : null));
  return found ? { node: found } : null;
}

export function findNodes(
  root: StoryNode,
  predicate: (node: StoryNode, parent: StoryNode | null) => boolean
): StoryNode[] {
  const results: StoryNode[] = [];
  walkTree(
    root,
    (node, parent) => {
      if (predicate(node, parent)) {
        results.push(node);
      }
      return null;
    },
    null
  );
  return results;
}

export async function marshallText(
  node: StoryNode,
  ctx: BaseActionContext,
  join: string = "\n",
  texts: string[] = []
): Promise<string> {
  if (node.type === "when") {
    const atts = await renderAtts(node.atts, ctx);
    const cond = await ctx.evaluator(atts.cond, ctx.scope);
    if (cond) {
      for (let i = 0; i < node.kids.length; i++) {
        texts.push(await marshallText(node.kids[i], ctx, join));
      }
    }
  } else {
    if (TEXT_CONTENT_TAGS.includes(node.type)) {
      texts.push(node.text);
    }
    for (let i = 0; i < node.kids.length; i++) {
      texts.push(await marshallText(node.kids[i], ctx, join));
    }
  }
  return texts.join(join);
}

export async function collateText(
  node: StoryNode,
  join: string = "\n",
  texts: string[] = []
): Promise<string> {
  if (TEXT_CONTENT_TAGS.includes(node.type)) {
    texts.push(node.text);
  }
  for (let i = 0; i < node.kids.length; i++) {
    texts.push(await collateText(node.kids[i], join));
  }
  return texts.join(join);
}

export function cloneNode(node: StoryNode): StoryNode {
  return {
    addr: node.addr,
    type: node.type,
    atts: { ...node.atts },
    text: node.text,
    kids: node.kids.map((kid) => cloneNode(kid)),
  };
}

export function assignAddrs(node: StoryNode) {
  const start = node.addr ?? "0";
  function walk(curr: StoryNode, addr: string) {
    curr.addr = addr;
    for (let i = 0; i < curr.kids.length; i++) {
      walk(curr.kids[i], `${addr}.${i}`);
    }
  }
  walk(node, start);
}

export function dumpTree(node: BaseNode | null, indent = ""): string {
  if (!node) {
    return "";
  }

  const lines: string[] = [];

  // Build attributes string
  const attrPairs = Object.entries(node.atts)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  const attrString = attrPairs ? ` ${attrPairs}` : "";

  // For text nodes, show their content inline
  if (node.type === TEXT_TAG) {
    const textContent = node.text?.trim();
    if (textContent) {
      lines.push(`${indent}<${node.type}>${textContent}</${node.type}>`);
    } else {
      lines.push(`${indent}<${node.type} />`);
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
      `${indent}<${node.type}${attrString}>${directTextContent}</${node.type}>`
    );
  } else if (node.kids.length === 0) {
    // Self-closing tag
    lines.push(`${indent}<${node.type}${attrString} />`);
  } else {
    // Tag with children
    lines.push(`${indent}<${node.type}${attrString}>`);

    // Add children
    for (const child of node.kids) {
      lines.push(dumpTree(child, indent + "  "));
    }

    lines.push(`${indent}</${node.type}>`);
  }

  return lines.join("\n");
}
