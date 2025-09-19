import { parse as parseSelector, Selector } from "css-what";
import { BaseNode } from "./StoryNodeHelpers";

type AttrMatcher = {
  name: string;
  value: string | null;
  action: "equals" | "exists";
  ignoreCase: boolean;
};

type SimpleSelector = {
  tag: string | null;
  attrs: AttrMatcher[];
};

type MacroOperation =
  | { kind: "set"; attr: string; value: string }
  | { kind: "remove"; attr: string }
  | { kind: "rename"; tag: string }
  | { kind: "append"; nodes: BaseNode[] }
  | { kind: "prepend"; nodes: BaseNode[] }
  | { kind: "replace"; nodes: BaseNode[] };

export type MacroDefinition = {
  id: string | null;
  selectors: SimpleSelector[];
  operations: MacroOperation[];
};

type CollectState = {
  nodes: BaseNode[];
  macros: MacroDefinition[];
};

export function collectMacros(nodes: BaseNode[]): CollectState {
  const state: CollectState = { nodes: [], macros: [] };
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "macro") {
      state.macros.push(parseMacro(node));
      continue;
    }
    const kids = collectMacros(node.kids);
    state.macros.push(...kids.macros);
    state.nodes.push({
      type: node.type,
      atts: { ...node.atts },
      text: node.text,
      kids: kids.nodes,
    });
  }
  return state;
}

export function applyMacros(
  nodes: BaseNode[],
  macros: MacroDefinition[]
): BaseNode[] {
  let current = nodes.map(cloneNode);
  for (let i = 0; i < macros.length; i++) {
    current = applyMacro(current, macros[i]);
  }
  return current;
}

function applyMacro(nodes: BaseNode[], macro: MacroDefinition): BaseNode[] {
  const out: BaseNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    out.push(...transformNode(node, macro));
  }
  return out;
}

function transformNode(node: BaseNode, macro: MacroDefinition): BaseNode[] {
  if (node.type === "#text") {
    return [cloneNode(node)];
  }
  const cloned: BaseNode = {
    type: node.type,
    atts: { ...node.atts },
    text: node.text,
    kids: [],
  };
  cloned.kids = applyMacro(node.kids, macro);
  if (!matchesSelectors(cloned, macro.selectors)) {
    return [cloned];
  }
  return executeOperations(cloned, macro.operations);
}

function executeOperations(
  node: BaseNode,
  ops: MacroOperation[]
): BaseNode[] {
  let current = node;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
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
      current.kids.push(...cloneNodes(op.nodes));
      continue;
    }
    if (op.kind === "prepend") {
      current.kids = [...cloneNodes(op.nodes), ...current.kids];
      continue;
    }
    if (op.kind === "replace") {
      return cloneNodes(op.nodes);
    }
  }
  return [current];
}

function matchesSelectors(
  node: BaseNode,
  selectors: SimpleSelector[]
): boolean {
  if (!selectors.length) {
    return false;
  }
  for (let i = 0; i < selectors.length; i++) {
    if (matchesSelector(node, selectors[i])) {
      return true;
    }
  }
  return false;
}

function matchesSelector(node: BaseNode, selector: SimpleSelector): boolean {
  if (node.type === "#text") {
    return false;
  }
  if (selector.tag && node.type !== selector.tag) {
    return false;
  }
  for (let i = 0; i < selector.attrs.length; i++) {
    const matcher = selector.attrs[i];
    const value = node.atts[matcher.name];
    if (matcher.action === "exists") {
      if (value === undefined) {
        return false;
      }
      continue;
    }
    if (matcher.action === "equals") {
      if (value === undefined) {
        return false;
      }
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

function parseMacro(node: BaseNode): MacroDefinition {
  const match = node.atts.match;
  if (!match) {
    throw new Error("macro missing match attribute");
  }
  const selectors = compileSelectors(match);
  const operations: MacroOperation[] = [];
  for (let i = 0; i < node.kids.length; i++) {
    const child = node.kids[i];
    if (child.type === "#text") {
      continue;
    }
    if (child.type === "set") {
      const attr = child.atts.attr;
      const value = child.atts.value;
      if (!attr || value === undefined) {
        throw new Error("set requires attr and value");
      }
      operations.push({ kind: "set", attr, value });
      continue;
    }
    if (child.type === "remove") {
      const attr = child.atts.attr;
      if (!attr) {
        throw new Error("remove requires attr");
      }
      operations.push({ kind: "remove", attr });
      continue;
    }
    if (child.type === "rename") {
      const tag = child.atts.to;
      if (!tag) {
        throw new Error("rename requires to");
      }
      operations.push({ kind: "rename", tag });
      continue;
    }
    if (child.type === "append") {
      operations.push({ kind: "append", nodes: child.kids.map(cloneNode) });
      continue;
    }
    if (child.type === "prepend") {
      operations.push({ kind: "prepend", nodes: child.kids.map(cloneNode) });
      continue;
    }
    if (child.type === "replace") {
      operations.push({ kind: "replace", nodes: child.kids.map(cloneNode) });
      continue;
    }
    throw new Error(`Unsupported macro operation: ${child.type}`);
  }
  return {
    id: node.atts.id ?? null,
    selectors,
    operations,
  };
}

function compileSelectors(input: string): SimpleSelector[] {
  const parsed = parseSelector(input);
  const selectors: SimpleSelector[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const tokens = parsed[i] as Selector[];
    let tag: string | null = null;
    const attrs: AttrMatcher[] = [];
    for (let j = 0; j < tokens.length; j++) {
      const token = tokens[j];
      if (token.type === "tag") {
        tag = token.name;
        continue;
      }
      if (token.type === "universal") {
        continue;
      }
      if (token.type === "attribute") {
        if (token.action === "exists") {
          attrs.push({
            name: token.name,
            value: null,
            action: "exists",
            ignoreCase: Boolean(token.ignoreCase),
          });
          continue;
        }
        if (token.action === "equals") {
          attrs.push({
            name: token.name,
            value: token.value ?? "",
            action: "equals",
            ignoreCase: Boolean(token.ignoreCase),
          });
          continue;
        }
        throw new Error(`Unsupported attribute action: ${token.action}`);
      }
      throw new Error(`Unsupported selector token: ${token.type}`);
    }
    selectors.push({ tag, attrs });
  }
  return selectors;
}

function cloneNode(node: BaseNode): BaseNode {
  return {
    type: node.type,
    atts: { ...node.atts },
    text: node.text,
    kids: node.kids.map(cloneNode),
  };
}

function cloneNodes(nodes: BaseNode[]): BaseNode[] {
  const out: BaseNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    out.push(cloneNode(nodes[i]));
  }
  return out;
}
