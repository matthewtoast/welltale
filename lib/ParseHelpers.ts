import matter from "gray-matter";
import { fromHtml } from "hast-util-from-html";
import { micromark } from "micromark";
import { frontmatter, frontmatterHtml } from "micromark-extension-frontmatter";
import { isBlank } from "./TextHelpers";

export type Section = {
  path: string;
  meta: Record<string, any>;
  root: Node;
};

export type Node = {
  id: string;
  tag: string;
  atts: Record<string, string>;
  kids: Node[];
  text: string;
};

export function traverseNodeTree(
  root: Node,
  visitor: (node: Node, parent: Node | null, depth: number) => void
): void {
  function walk(node: Node, parent: Node | null, depth: number) {
    visitor(node, parent, depth);
    node.kids.forEach((child) => walk(child, node, depth + 1));
  }
  walk(root, null, 0);
}

export function findNode(
  root: Node,
  predicate: (node: Node, parent: Node | null, depth: number) => boolean
): Node | null {
  let found: Node | null = null;
  function walk(node: Node, parent: Node | null, depth: number) {
    if (found) return;
    if (predicate(node, parent, depth)) {
      found = node;
      return;
    }
    for (const child of node.kids) {
      walk(child, node, depth + 1);
      if (found) return;
    }
  }
  walk(root, null, 0);
  return found;
}

function preprocessSelfClosingTags(content: string): string {
  return content.replace(
    /<([a-zA-Z][\w-]*)\s*([^>]*?)\/>/g,
    (match, tag, attrs) => {
      const voidElements = [
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
      ];
      if (voidElements.includes(tag.toLowerCase())) {
        return match;
      }
      return `<${tag}${attrs ? " " + attrs : ""}></${tag}>`;
    }
  );
}

export function parseMarkdownToSection(md: string) {
  const { data, content } = matter(md);
  const preprocessedContent = preprocessSelfClosingTags(content);
  const html = micromark(preprocessedContent, {
    extensions: [frontmatter(["yaml"])],
    htmlExtensions: [frontmatterHtml(["yaml"])],
    allowDangerousHtml: true,
  });
  const tree = fromHtml(html, { fragment: true });
  const root = hastNodeToNodeInfo(tree, "0");
  return { root, meta: data };
}

export type HastNode = {
  type: "root" | "comment" | "element" | "text" | "doctype";
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

export const mapTraverse = <T>(
  node: HastNode,
  visitor: (
    node: HastNode,
    idx: number,
    parent: HastNode | null,
    parentIdx: number | null
  ) => T
): T[] => {
  let idCounter = 0;
  const results: T[] = [];
  const walk = (
    n: HastNode,
    parent: HastNode | null,
    parentId: number | null
  ) => {
    const thisId = idCounter++;
    results.push(visitor(n, thisId, parent, parentId));
    if (n.children) {
      n.children.forEach((c: HastNode) => walk(c, n, thisId));
    }
  };
  walk(node, null, null);
  return results;
};

export function isNodeEmpty(node: Node): boolean {
  const hasText = !isBlank(node.text);
  const hasChildren = node.kids.length > 0;
  const isVoidElement = ["img", "br", "hr", "input", "meta"].includes(node.tag);
  return !hasText && !hasChildren && !isVoidElement;
}

export function shouldContainOnlyText(node: HastNode) {
  const hierarchical = [
    "ul",
    "ol",
    "li",
    "root",
    "if",
    "case",
    "unless",
  ].includes(node.tagName ?? "");
  return !hierarchical;
}

export function hastNodeToNodeInfo(node: HastNode, id: string): Node {
  const kids = (node.children ?? []).map((hn, nidx) =>
    hastNodeToNodeInfo(hn, `${id}.${nidx}`)
  );

  let text = node.value ?? "";
  if (shouldContainOnlyText(node)) {
    text =
      text +
      kids
        .map((kid) => {
          if (kid.tag === "strong" || kid.tag === "b") {
            return `**${kid.text}**`;
          }
          if (kid.tag === "i" || kid.tag === "em") {
            return `_${kid.text}_`;
          }
          if (kid.tag === "a") {
            return `[${kid.text}](${kid.atts.href ?? ""})`;
          }
          if (kid.tag === "img") {
            return `![${kid.atts.src ?? ""}]`;
          }
          if (kid.tag === "code") {
            return `\`${kid.text}\``;
          }
          // Handle headings h1-h6
          if (/^h[1-6]$/.test(kid.tag)) {
            const level = parseInt(kid.tag[1], 10);
            return `${"#".repeat(level)} ${kid.text}`;
          }
          return kid.text;
        })
        .join(" ");
  }

  const atts: Record<string, string> = {};
  if (node.properties) {
    for (const [key, value] of Object.entries(node.properties)) {
      if (value != null) {
        atts[key] = String(value);
      }
    }
  }
  return {
    id,
    tag: node.tagName ?? node.type,
    atts,
    text,
    kids,
  };
}
