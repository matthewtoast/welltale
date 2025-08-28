import { Node } from "./NodeHelpers";

export function dumpTree(node: Node, indent = ""): string {
  const lines: string[] = [];
  
  // Build attributes string
  const attrPairs = Object.entries(node.atts)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  const attrString = attrPairs ? ` ${attrPairs}` : "";
  
  // For text nodes, show their content inline
  if (node.tag === "text") {
    const textContent = node.text?.trim();
    if (textContent) {
      lines.push(`${indent}<${node.tag} id="${node.id}">${textContent}</${node.tag}>`);
    } else {
      lines.push(`${indent}<${node.tag} id="${node.id}" />`);
    }
    return lines.join("\n");
  }
  
  // Get direct text content (from text children only)
  const directTextContent = node.kids
    .filter(k => k.tag === "text")
    .map(k => k.text?.trim())
    .filter(Boolean)
    .join("");
    
  const hasNonTextChildren = node.kids.some(k => k.tag !== "text");
  
  if (!hasNonTextChildren && directTextContent) {
    // Leaf node with text content
    lines.push(`${indent}<${node.tag} id="${node.id}"${attrString}>${directTextContent}</${node.tag}>`);
  } else if (node.kids.length === 0) {
    // Self-closing tag
    lines.push(`${indent}<${node.tag} id="${node.id}"${attrString} />`);
  } else {
    // Tag with children
    lines.push(`${indent}<${node.tag} id="${node.id}"${attrString}>`);
    
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
  return result.split("\n").filter(line => line.trim()).join("\n");
}