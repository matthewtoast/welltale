import matter from "gray-matter";
import { fromHtml } from "hast-util-from-html";
import { camelCase } from "lodash";
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
  parent: Node | null;
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

const VOID_ELEMENTS = [
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

// List of tags that are typically self-closing in this system
const LIKELY_SELF_CLOSING = [
  "jump",
  "input",
  "wait",
  "sound",
  "set",
  "code",
  "stop",
  "yield",
  "call",
  "return",
  "break",
  "continue",
];

export function preprocessSelfClosingTags(content: string): string {
  // First, handle properly self-closing tags (with />)
  let processed = content.replace(
    /<([a-zA-Z][\w-]*)\s*([^>]*?)\/>/g,
    (match, tag, attrs) => {
      if (VOID_ELEMENTS.includes(tag.toLowerCase())) {
        return match;
      }
      return `<${tag}${attrs ? " " + attrs : ""}></${tag}>`;
    }
  );

  // Now handle tags that look like they should be self-closing
  // This regex matches tags that are on their own line or followed by another tag/text
  processed = processed.replace(
    /<([a-zA-Z][\w-]*)\s*([^>]*?)>(?=\s*(?:<|$|\n|[A-Z]))/gm,
    (match, tag, attrs, offset, str) => {
      const tagLower = tag.toLowerCase();

      // Skip if it's a void element or if it's already followed by a closing tag
      if (VOID_ELEMENTS.includes(tagLower)) {
        return match;
      }

      // Check if this tag has a matching closing tag
      const closingTagRegex = new RegExp(`</${tag}\\s*>`, "i");
      const remainingContent = str.slice(offset + match.length);
      const hasClosingTag = closingTagRegex.test(
        remainingContent.slice(0, 1000)
      ); // Check next 1000 chars

      // If it's a likely self-closing tag and no closing tag found nearby, convert it
      if (LIKELY_SELF_CLOSING.includes(tagLower) && !hasClosingTag) {
        return `<${tag}${attrs ? " " + attrs : ""}></${tag}>`;
      }

      return match;
    }
  );

  return processed;
}

function isFlowControlElement(node: HastNode): boolean {
  const flowElements = [
    "if", "else", "jump", "input", "set", "yield", "block", "llm", "sound", 
    "wait", "sleep", "case", "unless"
  ];
  return flowElements.includes(node.tagName || "");
}

function isTextOrFormattingElement(node: HastNode): boolean {
  if (node.type === "text") return true;
  const formattingElements = [
    "strong", "b", "em", "i", "u", "del", "s", "mark", "small", "sup", "sub", "a", "img", "code"
  ];
  return formattingElements.includes(node.tagName || "");
}

function createMergedTextNode(nodes: HastNode[]): HastNode {
  let mergedText = "";
  
  for (const node of nodes) {
    if (node.type === "text") {
      mergedText += node.value || "";
    } else if (node.tagName === "strong" || node.tagName === "b") {
      mergedText += `**${getTextContent(node)}**`;
    } else if (node.tagName === "em" || node.tagName === "i") {
      mergedText += `_${getTextContent(node)}_`;
    } else if (node.tagName === "code") {
      mergedText += `\`${getTextContent(node)}\``;
    } else if (node.tagName === "a") {
      const href = node.properties?.href || "";
      mergedText += `[${getTextContent(node)}](${href})`;
    } else if (node.tagName === "img") {
      const src = node.properties?.src || "";
      const alt = node.properties?.alt || "";
      mergedText += `![${alt}](${src})`;
    } else {
      // For other formatting elements, just extract text
      mergedText += getTextContent(node);
    }
  }
  
  return {
    type: "text",
    value: mergedText
  };
}

function getTextContent(node: HastNode): string {
  if (node.type === "text") {
    return node.value || "";
  }
  if (node.children) {
    return node.children.map(getTextContent).join("");
  }
  return "";
}

function groupContiguousText(node: HastNode): HastNode {
  if (!node.children) return node;
  
  const newChildren: HastNode[] = [];
  let currentTextGroup: HastNode[] = [];
  
  function flushTextGroup() {
    if (currentTextGroup.length > 0) {
      if (currentTextGroup.length === 1 && currentTextGroup[0].type === "text") {
        // Single text node, only add if it has content
        const textNode = currentTextGroup[0];
        if (textNode.value && textNode.value.trim()) {
          newChildren.push(textNode);
        }
      } else {
        // Multiple nodes or formatting, merge them
        const merged = createMergedTextNode(currentTextGroup);
        // Only add if the merged text has content
        if (merged.value && merged.value.trim()) {
          newChildren.push(merged);
        }
      }
      currentTextGroup = [];
    }
  }
  
  for (const child of node.children) {
    if (isFlowControlElement(child)) {
      flushTextGroup();
      newChildren.push(groupContiguousText(child)); // Recurse into flow elements
    } else if (isTextOrFormattingElement(child)) {
      // Skip completely empty text nodes
      if (child.type === "text" && (!child.value || !child.value.trim())) {
        continue;
      }
      currentTextGroup.push(child);
    } else {
      // Structural elements (h1, p, etc.)
      flushTextGroup();
      newChildren.push(groupContiguousText(child)); // Recurse
    }
  }
  
  flushTextGroup(); // Handle any remaining text group
  
  return { ...node, children: newChildren };
}

export function markdownToTree(md: string) {
  const { data, content } = matter(md);
  const preprocessedContent = preprocessSelfClosingTags(content);
  const html = micromark(preprocessedContent, {
    extensions: [frontmatter(["yaml"])],
    htmlExtensions: [frontmatterHtml(["yaml"])],
    allowDangerousHtml: true,
  });
  const tree = fromHtml(html, { fragment: true });
  const groupedTree = groupContiguousText(tree);
  const root = hastNodeToNodeInfo(groupedTree, "0");
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
  // Since we're now using groupContiguousText, we can simplify this
  // Only paragraphs that end up with a single text child should be flattened
  if (node.tagName === "p" && node.children && node.children.length === 1) {
    const child = node.children[0];
    return child.type === "text";
  }
  
  // Never collapse structural elements
  const structuralElements = [
    "ul", "ol", "li", "root", "if", "case", "unless", "div", "section", "article",
    "header", "footer", "main", "aside", "nav", "blockquote", "pre", "code"
  ];
  
  return !structuralElements.includes(node.tagName ?? "");
}

export function hastNodeToNodeInfo(
  node: HastNode,
  id: string,
  parent: Node | null = null
): Node {
  // Create the node first without kids
  const result: Node = {
    id,
    tag: "",
    atts: {},
    text: "",
    kids: [],
    parent,
  };

  // Now create kids with this node as parent
  const kids = (node.children ?? []).map((hn, nidx) =>
    hastNodeToNodeInfo(hn, `${id}.${nidx}`, result)
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
      if (value !== null) {
        atts[camelCase(key)] = String(value);
      }
    }
  }
  // Update the result with the final values
  result.tag = node.tagName ?? node.type;
  result.atts = atts;
  result.text = text;
  result.kids = kids;

  return result;
}

export function skipBlock(
  blockNode: Node,
  section: Section
): { node: Node; section: Section } | null {
  // Skip past the entire block by going to its next sibling
  return nextNode(blockNode, section, false);
}

export function nextNode(
  curr: Node,
  section: Section,
  useKids: boolean
): { node: Node; section: Section } | null {
  // If useKids is true and current node has children, go to first child
  if (useKids && curr.kids.length > 0) {
    return { node: curr.kids[0], section };
  }

  // Find the next sibling by traversing up the tree
  let current = curr;
  let parent = current.parent;

  while (parent) {
    // Find current node's position in parent's children
    const siblingIndex = parent.kids.findIndex(
      (child) => child.id === current.id
    );

    // If there's a next sibling, return it
    if (siblingIndex >= 0 && siblingIndex < parent.kids.length - 1) {
      const nextSibling = parent.kids[siblingIndex + 1];

      // Special case: if we're leaving a when block and next sibling is also when,
      // skip to parent's next (exit the case)
      if (current.tag === "when" && nextSibling.tag === "when") {
        current = parent;
        parent = parent.parent;
        continue;
      }

      return { node: nextSibling, section };
    }

    // No next sibling, move up to parent and continue
    current = parent;
    parent = parent.parent;
  }

  // Reached the root with no next sibling found
  return null;
}

export function searchInSection(
  section: Section,
  searchTerm: string
): Node | null {
  return findNode(section.root, (node) => {
    // 1. Exact node ID match
    if (node.id === searchTerm) return true;

    // 2. Attribute ID match
    if (node.atts.id === searchTerm) return true;

    // 3. Heading text match (case insensitive)
    if (/^h[1-6]$/.test(node.tag)) {
      const headingText = node.text.trim().toLowerCase();
      if (headingText === searchTerm.toLowerCase()) return true;

      // 4. Slugified heading match
      const slugified = headingText
        .replace(/[^\w\s-]/g, "") // Remove special chars except spaces and hyphens
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .toLowerCase();
      if (slugified === searchTerm.toLowerCase()) return true;
    }

    return false;
  });
}

export function searchNode(
  sections: Section[],
  currentSection: Section,
  flex: string | null | undefined
): { node: Node; section: Section } | null {
  if (!flex || isBlank(flex)) {
    return null;
  }

  // Parse scoped identifier like "blah.md.0.0.12"
  const scopedMatch = flex.match(/^(.+\.md)\.(.+)$/);
  if (scopedMatch) {
    const [, sectionPath, nodeId] = scopedMatch;
    const targetSection = sections.find((s) => s.path === sectionPath);
    if (targetSection) {
      const node = searchInSection(targetSection, nodeId);
      if (node) return { node, section: targetSection };
    }
    return null;
  }

  // Search starting with current section, then others
  const sectionsToSearch = [
    currentSection,
    ...sections.filter((s) => s.path !== currentSection.path),
  ];

  for (const section of sectionsToSearch) {
    const node = searchInSection(section, flex);
    if (node) {
      return { node, section };
    }
  }

  return null;
}
