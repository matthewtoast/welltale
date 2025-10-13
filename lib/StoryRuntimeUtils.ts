import { cloneNode, findNodes, BaseNode, updateChildAddresses } from "./StoryNodeHelpers";
import { StoryNode } from "./StoryTypes";
import { MacroDefinition } from "./StoryMacro";
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
      !node.type.startsWith("#")
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

export function applyRuntimeMacros(
  root: StoryNode,
  macros: MacroDefinition[]
): void {
  if (macros.length === 0) return;
  let current = root.kids;
  for (let i = 0; i < macros.length; i++) {
    current = applyMacroList(current, macros[i]);
    root.kids = current;
  }
  updateChildAddresses(root);
}

function applyMacroList(nodes: StoryNode[], macro: MacroDefinition): StoryNode[] {
  const out: StoryNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    out.push(...transformNodeForMacro(nodes[i], macro));
  }
  return out;
}

function transformNodeForMacro(
  node: StoryNode,
  macro: MacroDefinition
): StoryNode[] {
  if (node.type !== "#text") {
    node.kids = applyMacroList(node.kids, macro);
  }
  if (!matchesSelectors(node, macro.selectors)) {
    return [node];
  }
  return executeOperations(node, macro.operations);
}

function matchesSelectors(
  node: StoryNode,
  selectors: MacroDefinition["selectors"]
): boolean {
  if (!selectors.length) return false;
  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i];
    if (matchesSelector(node, selector)) return true;
  }
  return false;
}

function matchesSelector(node: StoryNode, selector: MacroDefinition["selectors"][number]): boolean {
  if (node.type === "#text") return false;
  if (selector.tag && node.type !== selector.tag) return false;
  for (let i = 0; i < selector.attrs.length; i++) {
    const matcher = selector.attrs[i];
    const value = node.atts[matcher.name];
    if (matcher.action === "exists") {
      if (value === undefined) return false;
      continue;
    }
    if (matcher.action === "equals") {
      if (value === undefined) return false;
      if (matcher.ignoreCase) {
        if (value.toLocaleLowerCase() !== matcher.value!.toLocaleLowerCase()) {
          return false;
        }
      } else if (value !== matcher.value) {
        return false;
      }
      continue;
    }
    return false;
  }
  return true;
}

function executeOperations(
  node: StoryNode,
  operations: MacroDefinition["operations"]
): StoryNode[] {
  let current = node;
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (op.kind === "set") {
      current.atts[op.attr] = op.value;
      continue;
    }
    if (op.kind === "remove") {
      delete current.atts[op.attr];
      continue;
    }
    if (op.kind === "rename") {
      current.type = op.tag;
      continue;
    }
    if (op.kind === "append") {
      current.kids.push(...instantiateNodes(op.nodes));
      continue;
    }
    if (op.kind === "prepend") {
      current.kids = [...instantiateNodes(op.nodes), ...current.kids];
      continue;
    }
    if (op.kind === "replace") {
      return instantiateNodes(op.nodes);
    }
  }
  return [current];
}

function instantiateNodes(nodes: BaseNode[]): StoryNode[] {
  const out: StoryNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    out.push(instantiateNode(nodes[i]));
  }
  return out;
}

function instantiateNode(node: BaseNode): StoryNode {
  return {
    addr: "",
    type: node.type,
    atts: { ...node.atts },
    text: node.text,
    kids: instantiateNodes(node.kids),
  };
}
