import { fromHtml } from "hast-util-from-html";
import type { Content, Element, Root } from "hast";
import { smoosh, snorm } from "./TextHelpers";

const BLOCK_TAGS = new Set([
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

const SKIP_TAGS = new Set(["script", "style", "noscript", "nav", "header", "footer", "svg", "iframe"]);

const LINE_TAGS = new Set(["br", "hr"]);

function textOf(node: Content): string {
  if (node.type === "text") {
    return node.value;
  }
  if (node.type === "element") {
    if (SKIP_TAGS.has(node.tagName)) {
      return "";
    }
    if (LINE_TAGS.has(node.tagName)) {
      return "\n";
    }
    let out = "";
    for (let i = 0; i < node.children.length; i++) {
      out += textOf(node.children[i]);
    }
    return out;
  }
  return "";
}

function collect(node: Content, out: string[]): void {
  if (node.type !== "element") {
    return;
  }
  if (SKIP_TAGS.has(node.tagName)) {
    return;
  }
  if (BLOCK_TAGS.has(node.tagName)) {
    const raw = textOf(node);
    const normalized = snorm(raw);
    if (normalized) {
      out.push(normalized);
    }
    return;
  }
  for (let i = 0; i < node.children.length; i++) {
    collect(node.children[i], out);
  }
}

export function extractBlocks(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) {
    return [];
  }
  const root = fromHtml(trimmed, { fragment: true }) as Root;
  const out: string[] = [];
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (child.type === "text") {
      const normalized = snorm(child.value);
      if (normalized) {
        out.push(normalized);
      }
      continue;
    }
    collect(child, out);
  }
  return out.map((entry) => smoosh(entry));
}
