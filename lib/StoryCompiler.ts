import { DOMParser } from "@xmldom/xmldom";
import { Cartridge } from "./StoryEngine";

export type BaseNode = {
  type: string; // the tag name, e.g. p, block, #text, whatever
  atts: Record<string, string>; // the element attributes
  kids: BaseNode[]; // its children (can be empty array)
  text: string; // its text value (can be empty string)
};

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

export const parseXmlFragment = (frag: string): BaseNode => {
  const xml = `<root>${frag}</root>`;
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const root = doc.documentElement;
  return fromDom(root);
};

export const TEXT_TAG = "#text";
export const FRAG_TAG = "#fragment";

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

export function compileStory(cartridge: Cartridge) {
  const root: StoryNode = {
    addr: "0",
    type: "root",
    atts: {},
    kids: [],
    text: "",
  };
  const keys = Object.keys(cartridge);
  let currentIndex = 0;
  for (let i = 0; i < keys.length; i++) {
    const path = keys[i];
    const content = cartridge[path].toString("utf-8");
    const section = parseXmlFragment(content);
    // Move each child of the section's top node to root, remapping addresses
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
