import { cloneNode, findNodes, BaseNode } from "./StoryNodeHelpers";
import { StoryNode } from "./StoryTypes";
import { applyMacros, MacroDefinition } from "./StoryMacro";
import { isBlank } from "./TextHelpers";

export function processIncludeRuntime(
  includeNode: StoryNode,
  root: StoryNode,
  includeChain: string[] = []
): StoryNode[] {
  const targetId = includeNode.atts.id;
  if (isBlank(targetId)) {
    console.warn("Include node missing id attribute");
    return [];
  }

  // Prevent infinite recursion
  if (includeChain.includes(targetId)) {
    console.warn(`Include recursion detected for id "${targetId}"`);
    return [];
  }

  // Find the target element
  const moduleables = findNodes(
    root,
    (node) =>
      node.atts.id === targetId &&
      node.type !== "include" &&
      !node.type.startsWith("#") &&
      node.kids.length > 0
  );

  if (moduleables.length === 0) {
    console.warn(`Include target not found: ${targetId}`);
    return [];
  }

  const target = moduleables[0];
  const newChain = [...includeChain, targetId];
  
  // Clone the target's children and process any nested includes
  const clonedChildren = target.kids.map((child) => {
    const cloned = cloneNode(child);
    // Recursively process any includes in the cloned content
    processIncludesInNode(cloned, root, newChain);
    return cloned;
  });

  return clonedChildren;
}

function processIncludesInNode(
  node: StoryNode,
  root: StoryNode,
  includeChain: string[]
): void {
  for (let i = node.kids.length - 1; i >= 0; i--) {
    const child = node.kids[i];
    if (child.type === "include") {
      const replacements = processIncludeRuntime(child, root, includeChain);
      node.kids.splice(i, 1, ...replacements);
    } else {
      processIncludesInNode(child, root, includeChain);
    }
  }
}

export function applyMacroRuntimeToNode(
  node: StoryNode,
  macros: MacroDefinition[]
): void {
  if (macros.length === 0) return;

  // Convert StoryNode to BaseNode for macro processing
  const baseNode = {
    type: node.type,
    atts: { ...node.atts },
    text: node.text,
    kids: convertStoryNodesToBaseNodes(node.kids)
  };

  // Apply macros to this single node wrapped in an array
  const transformed = applyMacros([baseNode], macros);
  
  if (transformed.length !== 1) {
    console.warn("Macro transformation changed node count, using first result");
  }

  if (transformed.length > 0) {
    const result = transformed[0];
    // Update the original node in place (preserving addr)
    node.type = result.type;
    node.atts = result.atts;
    node.text = result.text;
    node.kids = convertBaseNodesToStoryNodes(result.kids, node.addr);
  }
}

function convertStoryNodesToBaseNodes(nodes: StoryNode[]): BaseNode[] {
  return nodes.map(node => ({
    type: node.type,
    atts: { ...node.atts },
    text: node.text,
    kids: convertStoryNodesToBaseNodes(node.kids)
  }));
}

function convertBaseNodesToStoryNodes(nodes: BaseNode[], parentAddr: string): StoryNode[] {
  return nodes.map((node, index) => ({
    addr: `${parentAddr}.${index}`,
    type: node.type,
    atts: { ...node.atts },
    text: node.text,
    kids: convertBaseNodesToStoryNodes(node.kids, `${parentAddr}.${index}`)
  }));
}