import matter from "gray-matter";
import { fromHtml } from "hast-util-from-html";
import { camelCase } from "lodash";
import { micromark } from "micromark";
import { frontmatter, frontmatterHtml } from "micromark-extension-frontmatter";
import { DefaultTreeAdapterMap, parse } from "parse5";
import { Cartridge } from "./StoryEngine";

type Parse5Node = DefaultTreeAdapterMap["node"];
type Parse5Element = DefaultTreeAdapterMap["element"];
type Parse5TextNode = DefaultTreeAdapterMap["textNode"];

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

  // Special handling for custom elements that might contain blank lines
  // This prevents markdown from breaking their structure with paragraph tags
  const elementsToWrap = [
    "block",
    "if",
    "scene",
    "chapter",
    "act",
    "dialog",
    "narration",
    "menu",
    "choice",
  ];

  elementsToWrap.forEach((tag) => {
    // Match opening tag, content, and closing tag
    const regex = new RegExp(`(<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>)`, "g");
    processed = processed.replace(regex, (match) => {
      // Wrap in a div to ensure proper isolation
      return `<div class="${tag}-container">${match}</div>`;
    });
  });

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
    "if",
    "else",
    "jump",
    "input",
    "set",
    "yield",
    "block",
    "llm",
    "sound",
    "wait",
    "sleep",
    "case",
    "unless",
  ];
  return flowElements.includes(node.tagName || "");
}

function isTextOrFormattingElement(node: HastNode): boolean {
  if (node.type === "text") return true;
  const formattingElements = [
    "strong",
    "b",
    "em",
    "i",
    "u",
    "del",
    "s",
    "mark",
    "small",
    "sup",
    "sub",
    "a",
    "img",
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
    value: mergedText,
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
      if (
        currentTextGroup.length === 1 &&
        currentTextGroup[0].type === "text"
      ) {
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

// HTML-first parsing approach
function parse5ToNode(
  parse5Node: Parse5Node,
  id: string,
  parent: Node | null = null
): Node | Node[] | null {
  if (parse5Node.nodeName === "#text") {
    const textNode = parse5Node as Parse5TextNode;
    const text = textNode.value;

    // Skip whitespace-only text nodes
    if (!text.trim()) {
      return null;
    }

    // Check if text contains markdown syntax
    const hasMarkdown = /[*_#`\[\]!]/.test(text);

    if (hasMarkdown) {
      // Parse the text as markdown
      const markdownHtml = micromark(text.trim(), { allowDangerousHtml: true });
      const markdownAst = fromHtml(markdownHtml, { fragment: true });

      // Convert HAST to our Node format
      const nodes = (markdownAst.children || [])
        .map((child, idx) => hastNodeToNodeInfo(child, `${id}.${idx}`, parent))
        .filter(Boolean);

      // If we got multiple nodes, return array; if single, return node
      return nodes.length === 1 ? nodes[0] : nodes;
    }

    // Plain text node
    return {
      id,
      tag: "text",
      atts: {},
      text: text.trim(),
      kids: [],
      parent,
    };
  }

  if (parse5Node.nodeName === "#document") {
    // Document root - process children
    const children: Node[] = [];
    if ("childNodes" in parse5Node && parse5Node.childNodes) {
      for (const [idx, child] of parse5Node.childNodes.entries()) {
        const result = parse5ToNode(child, `0.${idx}`, null);
        if (result) {
          if (Array.isArray(result)) {
            children.push(...result);
          } else {
            children.push(result);
          }
        }
      }
    }

    return {
      id: "0",
      tag: "root",
      atts: {},
      text: "",
      kids: children,
      parent: null,
    };
  }

  if (parse5Node.nodeName === "html" || parse5Node.nodeName === "head") {
    // Skip html/head wrappers, process children directly
    const children: Node[] = [];
    if ("childNodes" in parse5Node && parse5Node.childNodes) {
      for (const child of parse5Node.childNodes) {
        const result = parse5ToNode(child, id, parent);
        if (result) {
          if (Array.isArray(result)) {
            children.push(...result);
          } else {
            children.push(result);
          }
        }
      }
    }
    return children.length === 1
      ? children[0]
      : children.length > 0
        ? children
        : null;
  }

  if (parse5Node.nodeName === "body") {
    // Body - process children but don't create body node
    const children: Node[] = [];
    if ("childNodes" in parse5Node && parse5Node.childNodes) {
      for (const [idx, child] of parse5Node.childNodes.entries()) {
        const result = parse5ToNode(child, `${id}.${idx}`, parent);
        if (result) {
          if (Array.isArray(result)) {
            children.push(...result);
          } else {
            children.push(result);
          }
        }
      }
    }
    return children.length === 1
      ? children[0]
      : children.length > 0
        ? children
        : null;
  }

  // Regular element
  const element = parse5Node as Parse5Element;
  const result: Node = {
    id,
    tag: element.tagName,
    atts: {},
    text: "",
    kids: [],
    parent,
  };

  // Convert attributes
  if (element.attrs) {
    for (const attr of element.attrs) {
      result.atts[camelCase(attr.name)] = attr.value;
    }
  }

  // Process children
  if ("childNodes" in parse5Node && parse5Node.childNodes) {
    for (const [idx, child] of parse5Node.childNodes.entries()) {
      const childResult = parse5ToNode(child, `${id}.${idx}`, result);
      if (childResult) {
        if (Array.isArray(childResult)) {
          result.kids.push(...childResult);
        } else {
          result.kids.push(childResult);
        }
      }
    }
  }

  return result;
}

// Simplified self-closing tag preprocessing without div-wrapping
function preprocessSelfClosingTagsOnly(content: string): string {
  // Handle properly self-closing tags (with />)
  let processed = content.replace(
    /<([a-zA-Z][\w-]*)\s*([^>]*?)\/?>/g,
    (match, tag, attrs) => {
      if (VOID_ELEMENTS.includes(tag.toLowerCase())) {
        return match;
      }
      return `<${tag}${attrs ? " " + attrs : ""}></${tag}>`;
    }
  );

  // Handle likely self-closing tags that don't have closing tags
  processed = processed.replace(
    /<([a-zA-Z][\w-]*)\s*([^>]*?)>(?=\s*(?:<|$|\n|[A-Z]))/gm,
    (match, tag, attrs, offset, str) => {
      const tagLower = tag.toLowerCase();

      if (VOID_ELEMENTS.includes(tagLower)) {
        return match;
      }

      // Check if this tag has a matching closing tag
      const closingTagRegex = new RegExp(`</${tag}\\s*>`, "i");
      const remainingContent = str.slice(offset + match.length);
      const hasClosingTag = closingTagRegex.test(
        remainingContent.slice(0, 1000)
      );

      if (LIKELY_SELF_CLOSING.includes(tagLower) && !hasClosingTag) {
        return `<${tag}${attrs ? " " + attrs : ""}></${tag}>`;
      }

      return match;
    }
  );

  return processed;
}

export function htmlFirstToTree(md: string) {
  const { data, content } = matter(md);

  // Preprocess only self-closing tags without div-wrapping
  const preprocessedContent = preprocessSelfClosingTagsOnly(content);

  // Parse as HTML using parse5
  const parse5Ast = parse(preprocessedContent);

  // Convert to our Node format
  const result = parse5ToNode(parse5Ast, "0");

  // Ensure we have a root node
  const root = Array.isArray(result)
    ? { id: "0", tag: "root", atts: {}, text: "", kids: result, parent: null }
    : result || {
        id: "0",
        tag: "root",
        atts: {},
        text: "",
        kids: [],
        parent: null,
      };

  return { root, meta: data };
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

export function hastNodeToNodeInfo(
  node: HastNode,
  id: string,
  parent: Node | null = null
): Node {
  // Handle wrapped containers - unwrap them and return the inner element
  if (node.tagName === "div") {
    const className = node.properties?.class || node.properties?.className;
    if (
      className &&
      typeof className === "string" &&
      className.endsWith("-container")
    ) {
      // Extract the tag name from the class (e.g., "block-container" -> "block")
      const expectedTag = className.replace("-container", "");
      // Find the matching child and return it directly
      const wrappedChild = node.children?.find(
        (child) => child.tagName === expectedTag
      );
      if (wrappedChild) {
        return hastNodeToNodeInfo(wrappedChild, id, parent);
      }
    }
  }

  const result: Node = {
    id,
    tag: node.tagName ?? node.type,
    atts: {}, // Populate below
    text: node.value ?? "",
    kids: [],
    parent,
  };

  result.kids = (node.children ?? []).map((hn, nidx) =>
    hastNodeToNodeInfo(hn, `${id}.${nidx}`, result)
  );

  if (node.properties) {
    for (const [key, value] of Object.entries(node.properties)) {
      if (value !== null) {
        result.atts[camelCase(key)] = String(value);
      }
    }
  }

  return result;
}

export async function compile(cartridge: Cartridge) {
  const sources: Section[] = [];
  for (let path in cartridge) {
    const content = cartridge[path];
    if (path.endsWith(".json")) {
      sources.push(JSON.parse(content.toString("utf-8")));
    } else if (path.endsWith(".md")) {
      const { root, meta } = markdownToTree(content.toString("utf-8"));
      sources.push({ root, meta, path });
    }
  }
  return sources;
}
