import { evalExpr } from "./EvalUtils";
import { BaseActionContext, renderAtts } from "./StoryEngine";
import { StoryNode } from "./StoryTypes";
import { isBlank } from "./TextHelpers";

export const TEXT_TAG = "#text";

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
    const cond = evalExpr(atts.cond, ctx.scope, {}, ctx.rng);
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

export function cloneNode(node: StoryNode): StoryNode {
  return {
    addr: node.addr,
    type: node.type,
    atts: { ...node.atts },
    text: node.text,
    kids: node.kids.map((kid) => cloneNode(kid)),
  };
}

export type BaseNode = {
  type: string; // the tag name, e.g. p, block, #text, whatever
  atts: Record<string, string>; // the element attributes
  kids: BaseNode[]; // its children (can be empty array)
  text: string; // its text value (can be empty string)
};

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
