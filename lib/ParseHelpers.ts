import matter from "gray-matter";
import { fromHtml } from "hast-util-from-html";
import { micromark } from "micromark";
import { frontmatter, frontmatterHtml } from "micromark-extension-frontmatter";
import { isPresent } from "./TextHelpers";

export type StanzaType = "script" | "output" | "context" | "comment" | "scope";

export type Stanza = {
  type: StanzaType;
  atts: Record<string, any>;
  body: string;
};

export type StorySource = {
  metadata: Record<string, any>;
  stanzas: Stanza[];
};

function remapTag(tag: string): StanzaType {
  if (tag.startsWith("h")) {
    return "scope";
  }
  switch (tag) {
    case "p":
      return "output";
    case "script":
    case "pre":
    case "code":
      return "script";
    case "blockquote":
      return "context";
    // case "ul":
    // case "ol":
    //   return "branch";
  }
  return "comment";
}

export function parseMarkdownToChapter(md: string) {
  const { data, content } = matter(md);
  const html = micromark(content, {
    extensions: [frontmatter(["yaml"])],
    htmlExtensions: [frontmatterHtml(["yaml"])],
    allowDangerousHtml: true,
  });
  const tree = fromHtml(html, { fragment: true });
  const stanzas: Stanza[] = hastNodeToNodeInfo(tree, 0, -1)
    .kids.filter((kid) => isPresent(kid.text))
    .map((n) => ({
      type: remapTag(n.tag),
      atts: n.atts,
      body: n.text,
    }));
  return { stanzas, metadata: data };
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

type NodeInfo = {
  idx: number;
  tag: string;
  atts: Record<string, any>;
  kids: NodeInfo[];
  text: string;
  pidx: number;
};

export function hastNodeToNodeInfo(
  node: HastNode,
  idx: number,
  pidx: number
): NodeInfo {
  const kids = (node.children ?? []).map((hn, nidx) =>
    hastNodeToNodeInfo(hn, nidx, idx)
  );
  const text =
    (node.value ?? "") +
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
  return {
    tag: node.tagName ?? node.type,
    atts: node.properties ?? {},
    text,
    kids,
  } as NodeInfo;
}
