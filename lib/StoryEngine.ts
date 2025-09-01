import {
  cast,
  castToString,
  evalExpr,
  looksLikeBoolean,
  looksLikeNumber,
  stringToCastType,
} from "lib/EvalUtils";
import { parseNumberOrNull } from "lib/MathHelpers";
import { PRNG } from "lib/RandHelpers";
import { dumpTree, FRAG_TAG, StoryNode, TEXT_TAG } from "lib/StoryCompiler";
import {
  cleanSplit,
  cleanSplitRegex,
  isBlank,
  renderHandlebars,
} from "lib/TextHelpers";
import { isEmpty, omit } from "lodash";
import { TSerial } from "typings";
import { z } from "zod";
import { parseTaggedSpeakerLine } from "./DialogHelpers";
import { ServiceProvider } from "./ServiceProvider";

export const PLAYER_ID = "USER";
export const FALLBACK_SPEAKER = "HOST";

export type Cartridge = Record<string, Buffer | string>;

const StoryEventSchema = z.object({
  time: z.number(),
  from: z.string(),
  to: z.array(z.string()),
  obs: z.array(z.string()),
  body: z.string(),
});

export const PlaythruSchema = z.object({
  id: z.string(),
  time: z.number(),
  turn: z.number(),
  cycle: z.number(),
  loops: z.number(),
  address: z.string().nullable(),
  inputKey: z.string().nullable(),
  inputType: z.string().nullable(),
  callStack: z.array(
    z.object({
      returnAddress: z.string(),
      scope: z.record(z.any()),
    })
  ),
  state: z.record(z.any()).and(
    z.object({
      input: z.string(),
    })
  ),
  history: z.array(StoryEventSchema),
  genie: z.record(z.union([z.instanceof(Buffer), z.string()])).optional(),
});

export const StoryOptionsSchema = z.object({
  verbose: z.boolean(),
  seed: z.string(),
  loop: z.number(),
  ream: z.number(),
  autoInput: z.boolean(),
  doGenerateSpeech: z.boolean(),
  doGenerateSounds: z.boolean(),
});

// Derive types from Zod schemas
export type StoryEvent = z.infer<typeof StoryEventSchema>;
export type Playthru = z.infer<typeof PlaythruSchema>;
export type StoryOptions = z.infer<typeof StoryOptionsSchema>;

export function createDefaultPlaythru(id: string): Playthru {
  return {
    id,
    time: Date.now(),
    turn: 0,
    cycle: 0,
    loops: 0,
    address: null,
    inputKey: "input",
    inputType: "string",
    callStack: [],
    state: {
      input: "",
    },
    history: [],
  };
}

export interface Story {
  id: string;
  cartridge: Cartridge;
}

export type OP =
  | { type: "sleep"; duration: number }
  | { type: "get-input"; timeLimit: number | null; charLimit: number | null }
  | { type: "play-sound"; audio: string }
  | { type: "play-line"; audio: string; speaker: string; line: string }
  | { type: "story-end" };

export interface ActionContext {
  options: StoryOptions;
  main: StoryNode;
  root: StoryNode;
  orig: StoryNode;
  node: StoryNode;
  playthru: Playthru;
  rng: PRNG;
  scope: { [key: string]: TSerial };
}

export enum SeamType {
  INPUT = "input", // Client is expected to send user input in next call
  GRANT = "grant", // Client should call again to grant OK to next batch of work
  ERROR = "error", // Error was encountered, could not continue
  FINISH = "finish", // Story was completed
}

export interface ActionResult {
  ops: OP[];
  next: { node: StoryNode } | null;
}

interface ActionHandler {
  match: (node: StoryNode) => boolean;
  exec: (
    context: ActionContext,
    services: ServiceProvider
  ) => Promise<ActionResult>;
}

let calls = 0;

export async function advanceStory(
  provider: ServiceProvider,
  root: StoryNode,
  playthru: Playthru,
  options: StoryOptions
) {
  const out: OP[] = [];

  const rng = new PRNG(options.seed, playthru.cycle % 10_000);
  playthru.time = Date.now();
  playthru.turn++;

  if (calls++ < 1) {
    provider.log(dumpTree(root));
  }

  const main = findNodeFromRoot(root, (node) => node.type === "main") ?? root;

  assignInput(playthru.state.input, playthru);

  if (!playthru.address) {
    playthru.address = main.addr;
  }

  if (!isBlank(playthru.state.input)) {
    playthru.history.push(createEvent(PLAYER_ID, playthru.state.input));
  }

  provider.log(`ADV`, playthru.state.input, omit(playthru, "history"));

  function done(seam: SeamType, info: Record<string, string>) {
    provider.log("DONE", omit(playthru, "history"), out);
    playthru.cycle = rng.cycle;
    return { ops: out, playthru, seam, info };
  }

  const visits: Record<string, number> = {};
  let iterations = 0;

  while (true) {
    let node: StoryNode | null = findNodeFromRoot(
      root,
      (node) => node.addr === playthru.address
    );

    if (!node) {
      const error = `Node ${playthru.address} not found`;
      console.warn(error);
      return done(SeamType.ERROR, { error });
    }

    if (!visits[node.addr]) {
      visits[node.addr] += 1;
    } else {
      return done(SeamType.GRANT, {
        reason: `Loop encountered at node ${node.addr}`,
      });
    }

    if (iterations > 0 && iterations % options.ream === 0) {
      iterations += 1;
      return done(SeamType.GRANT, {
        reason: `Iteration ${iterations} reached`,
      });
    }

    const rendered = nodeToRenderedNode(node, getScope(playthru), rng);

    const ctx: ActionContext = {
      options,
      main,
      root,
      orig: node,
      node: rendered,
      playthru,
      rng,
      scope: getScope(playthru),
    };

    const handler = ACTION_HANDLERS.find((h) => h.match(node))!;
    const result = await handler.exec(ctx, provider);
    out.push(...result.ops);

    provider.log(
      `<${node.type} ${node.addr}${node.type.startsWith("h") ? ` "${node.text}"` : ""}${isEmpty(node.atts) ? "" : " " + JSON.stringify(node.atts)}>`,
      `~> ${result.next?.node.addr}`,
      result.ops
    );

    if (result.next) {
      // Check if we're currently in a yielded block and the next node escapes it
      if (
        playthru.callStack.length > 0 &&
        wouldEscapeCurrentBlock(node, result.next.node, root)
      ) {
        // Pop from callstack instead of using the next node
        const { returnAddress } = playthru.callStack.pop()!;
        playthru.address = returnAddress;
      } else {
        playthru.address = result.next.node.addr;
      }
    } else {
      // No next node - check if we should return from a block
      if (playthru.callStack.length > 0) {
        const { returnAddress } = playthru.callStack.pop()!;
        playthru.address = returnAddress;
      } else {
        if (playthru.loops < options.loop) {
          playthru.loops += 1;
          playthru.address = null;
        } else {
          out.push({ type: "story-end" });
        }
      }
    }

    if (out.length > 0) {
      const type = out[out.length - 1].type;
      if (type === "get-input") {
        return done(SeamType.INPUT, {});
      } else if (type === "story-end") {
        return done(SeamType.FINISH, {});
      }
    }
  }
}

export const ACTION_HANDLERS: ActionHandler[] = [
  {
    match: (node) => node.type === "root" || node.type === FRAG_TAG,
    exec: async (ctx) => {
      const next = nextNode(ctx.node, ctx.root, true);
      return {
        ops: [],
        next: next,
      };
    },
  },
  {
    match: (node) => node.type === "ul" || node.type === "ol",
    exec: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.root, true),
    }),
  },
  {
    match: (node: StoryNode) => node.type === "section" || node.type === "sec",
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, true),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type.startsWith("h"), // <h*>, <header>, <head>, <hr>
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) =>
      node.type === TEXT_TAG ||
      node.type === "text" || // Just in case someone wants to use <text>
      node.type === "p" ||
      node.type === "li" ||
      node.type === "span",
    exec: async (ctx, provider) => {
      const next = nextNode(ctx.node, ctx.root, true);
      const ops: OP[] = [];
      let text = ctx.node.text;
      // If we have a ref tag, assume it refers to a <stash>
      if (ctx.node.atts.ref) {
        const stored = castToString(ctx.scope[ctx.node.atts.ref]);
        if (stored) {
          text = renderHandlebars(stored, ctx.scope, ctx.rng);
        }
      }
      // Early exit spurious empty nodes
      if (isBlank(text)) {
        return {
          ops,
          next,
        };
      }
      const line = parseTaggedSpeakerLine(text);
      // Dynamic dialog variation using pipe character
      line.body = ctx.rng.randomElement(cleanSplit(line.body, "|"));
      const { url } = ctx.options.doGenerateSpeech
        ? await provider.generateSpeech(line)
        : { url: "" };
      ops.push({
        type: "play-line",
        audio: url,
        speaker: line.speaker,
        line: line.body,
      });
      const to: string[] = ctx.node.atts["to"]
        ? cleanSplit(ctx.node.atts["to"], ",")
        : [PLAYER_ID];
      const obs: string[] = ctx.node.atts["obs"]
        ? cleanSplit(ctx.node.atts["to"], ",")
        : [];
      ctx.playthru.history.push(createEvent(line.speaker, line.body, to, obs));
      return {
        ops,
        next,
      };
    },
  },
  {
    match: (node: StoryNode) =>
      [
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
      ].includes(node.type),
    exec: async (ctx) => {
      // For inline elements, we generally want to skip over them and continue with siblings
      // The text content will be handled by parent elements
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "if",
    exec: async (ctx) => {
      let next;
      const conditionTrue = evalExpr(
        ctx.node.atts.cond,
        ctx.scope,
        {},
        ctx.rng
      );
      if (conditionTrue && ctx.node.kids.length > 0) {
        // Find first non-else child
        const firstNonElse = ctx.node.kids.find((k) => k.type !== "else");
        if (firstNonElse) {
          next = { node: firstNonElse };
        } else {
          next = nextNode(ctx.node, ctx.root, false);
        }
      } else {
        // Look for else block
        const elseChild = ctx.node.kids.find((k) => k.type === "else");
        if (elseChild && elseChild.kids.length > 0) {
          next = { node: elseChild.kids[0] };
        } else {
          next = nextNode(ctx.node, ctx.root, false);
        }
      }
      return {
        ops: [],
        next,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "jump",
    exec: async (ctx) => {
      let next;
      if (
        !ctx.node.atts.if ||
        evalExpr(ctx.node.atts.if, ctx.scope, {}, ctx.rng)
      ) {
        next = searchForNode(ctx.root, ctx.node.atts.to);
      } else {
        next = nextNode(ctx.node, ctx.root, false);
      }
      return {
        ops: [],
        next,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "var" || node.type === "stash",
    exec: async (ctx) => {
      // In case of <stash> or <var stash> we render only at retrieve-time,
      // i.e. use the original node rather than the one whose attrs we rendered
      const node =
        ctx.node.type === "stash" || ctx.node.atts.stash ? ctx.orig : ctx.node;
      const rollup = collectAllText(node);
      const value = !isBlank(rollup) ? rollup : node.atts.value;
      const key =
        ctx.node.atts.name ??
        ctx.node.atts.var ??
        ctx.node.atts.to ??
        ctx.node.atts.key ??
        ctx.node.atts.id;
      ctx.playthru.state[key] = value;
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "pre", // <pre> wraps <code>, but sometimes not
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, true),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "code",
    exec: async (ctx) => {
      const codeChildren = ctx.node.kids.filter((k) => k.type === TEXT_TAG);
      if (codeChildren.length > 0) {
        codeChildren.forEach((tc) => {
          const lines = cleanSplitRegex(tc.text, /[;\n]/);
          lines.forEach((line) => {
            evalExpr(line, ctx.scope, {}, ctx.rng);
          });
        });
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "wait" || node.type === "sleep",
    exec: async (ctx) => ({
      ops: [
        {
          type: "sleep",
          duration:
            parseNumberOrNull(
              ctx.node.atts.duration ?? ctx.node.atts.for ?? ctx.node.atts.ms
            ) ?? 1,
        },
      ],
      next: nextNode(ctx.node, ctx.root, false),
    }),
  },
  {
    // Blocks are only rendered if <yield>-ed to
    match: (node: StoryNode) => node.type === "block",
    exec: async (ctx) => ({
      ops: [],
      next: skipBlock(ctx.node, ctx.root),
    }),
  },
  {
    match: (node: StoryNode) => node.type === "yield",
    exec: async (ctx) => {
      const targetBlockId = ctx.node.atts.to;
      const returnToNodeId = ctx.node.atts.returnTo ?? ctx.node.atts.return;
      if (!targetBlockId) {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.root, false),
        };
      }
      // Find the target block
      const blockResult = searchForNode(ctx.root, targetBlockId);
      if (!blockResult || blockResult.node.type !== "block") {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.root, false),
        };
      }
      // Determine return address
      let returnAddress: string;
      if (returnToNodeId) {
        const returnResult = searchForNode(ctx.root, returnToNodeId);
        if (returnResult) {
          returnAddress = returnResult.node.addr;
        } else {
          const next = nextNode(ctx.node, ctx.root, false);
          returnAddress = next?.node.addr ?? ctx.main.addr;
        }
      } else {
        const next = nextNode(ctx.node, ctx.root, false);
        returnAddress = next?.node.addr ?? ctx.main.addr;
      }
      // Extract scope variables (all attributes except 'to', 'return', and 'returnTo')
      const scope: { [key: string]: TSerial } = {};
      const reservedAtts = ["to", "return", "returnTo"];
      for (const [key, value] of Object.entries(ctx.node.atts)) {
        if (!reservedAtts.includes(key)) {
          scope[key] = value;
        }
      }
      ctx.playthru.callStack.push({ returnAddress, scope });
      // Go to first child of block (or next sibling if no children)
      if (blockResult.node.kids.length > 0) {
        return {
          ops: [],
          next: {
            node: blockResult.node.kids[0],
          },
        };
      } else {
        return {
          ops: [],
          next: nextNode(blockResult.node, ctx.root, false),
        };
      }
    },
  },
  {
    match: (node: StoryNode) => node.type === "sound" && !!node.atts.url,
    exec: async (ctx) => ({
      ops: [
        {
          type: "play-sound",
          audio: ctx.node.atts.url,
        },
      ],
      next: nextNode(ctx.node, ctx.root, false),
    }),
  },
  {
    match: (node: StoryNode) => node.type === "input",
    exec: async (ctx) => {
      const toKey = ctx.node.atts.to;
      if (toKey) {
        ctx.playthru.inputKey = toKey;
      }
      const castType =
        ctx.node.atts.as ?? ctx.node.atts.cast ?? ctx.node.atts.type;
      if (castType) {
        ctx.playthru.inputType = castType;
      }
      const next = nextNode(ctx.node, ctx.root, false);
      // If we're doing auto-playback, automatically assign instead of waiting
      if (ctx.options.autoInput && !isBlank(ctx.node.atts.auto)) {
        assignInput(ctx.node.atts.auto, ctx.playthru);
        return {
          ops: [],
          next,
        };
      }
      return {
        ops: [
          {
            type: "get-input",
            timeLimit: parseNumberOrNull(
              ctx.node.atts.timeLimit ?? ctx.node.atts.for
            ),
            charLimit: parseNumberOrNull(ctx.node.atts.charLimit),
          },
        ],
        next,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm",
    exec: async (ctx, provider) => {
      let schema = ctx.node.atts.to ?? ctx.node.atts.schema;
      if (isBlank(schema)) {
        schema = "_"; // Assigns to the _ variable
      }
      const rollup = collectAllText(ctx.node);
      const prompt = rollup ?? ctx.node.atts.prompt;
      if (!isBlank(prompt)) {
        const result = await provider.generateJson(prompt, schema);
        Object.assign(ctx.playthru.state, result);
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "sound" && !!node.atts.gen,
    exec: async (ctx, provider) => {
      const rollup = collectAllText(ctx.node);
      const prompt = rollup ?? ctx.node.atts.prompt;
      if (!isBlank(prompt)) {
        const { url } = ctx.options.doGenerateSounds
          ? await provider.generateSound(prompt)
          : { url: "" };
        return {
          ops: [{ type: "play-sound", audio: url }],
          next: nextNode(ctx.node, ctx.root, false),
        };
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    // Fallback: Any node not explicitly listed we'll skip over without visiting kids
    match: () => true,
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
];

export function skipBlock(
  blockNode: StoryNode,
  root: StoryNode
): { node: StoryNode } | null {
  // Skip past the entire block by going to its next sibling
  return nextNode(blockNode, root, false);
}

export function nextNode(
  curr: StoryNode,
  root: StoryNode,
  useKids: boolean
): { node: StoryNode } | null {
  // Given a node and the root of its tree, find the "next" node.
  // If useKids is true and current node has children, it's the first child
  if (useKids && curr.kids.length > 0) {
    return { node: curr.kids[0] };
  }

  // Find parent and check for next sibling
  const parent = parentNodeOf(curr, root);
  if (!parent) return null;

  const siblingIndex = parent.kids.findIndex((k) => k.addr === curr.addr);
  if (siblingIndex >= 0 && siblingIndex < parent.kids.length - 1) {
    return { node: parent.kids[siblingIndex + 1] };
  }

  // No more siblings, recurse up the tree
  return nextNode(parent, root, false);
}

export function parentNodeOf(
  node: StoryNode,
  root: StoryNode
): StoryNode | null {
  if (node.addr === root.addr) return null;
  return findNodeFromRoot(root, (n) => {
    return n.kids.some((k) => k.addr === node.addr);
  });
}

export function wouldEscapeCurrentBlock(
  currentNode: StoryNode,
  nextNode: StoryNode,
  root: StoryNode
): boolean {
  // Find the closest block ancestor of the current node
  let node: StoryNode | null = currentNode;
  let blockAncestor: StoryNode | null = null;

  // Walk up the tree to find the closest block ancestor
  while (node) {
    if (node.type === "block") {
      blockAncestor = node;
      break;
    }
    node = parentNodeOf(node, root);
  }

  // If no block ancestor, we can't escape from a block
  if (!blockAncestor) {
    return false;
  }

  // Check if the next node is outside this block's subtree
  // A node is inside the block if its address starts with the block's address + "."
  const blockPrefix = blockAncestor.addr + ".";
  return !nextNode.addr.startsWith(blockPrefix);
}

export function searchForNode(
  root: StoryNode,
  term: string | null | undefined
): { node: StoryNode } | null {
  if (!term || isBlank(term)) {
    return null;
  }
  let found: StoryNode | null = null;
  function walk(node: StoryNode) {
    if (found) return;
    if (node.atts.id === term) {
      found = node;
      return;
    }
    for (const kid of node.kids) {
      walk(kid);
      if (found) return;
    }
  }
  walk(root);
  return found ? { node: found } : null;
}

export function findNodeFromRoot(
  root: StoryNode,
  predicate: (
    node: StoryNode,
    parent: StoryNode | null,
    address: string
  ) => boolean,
  address: string = "0"
): StoryNode | null {
  let found: StoryNode | null = null;
  function walk(node: StoryNode, parent: StoryNode | null, address: string) {
    if (found) return;
    if (predicate(node, parent, address)) {
      found = node;
      return;
    }
    for (let i = 0; i < node.kids.length; i++) {
      walk(node.kids[i], node, `${address}.${i}`);
      if (found) return;
    }
  }
  walk(root, null, address);
  return found;
}

const TEXT_CONTENT_TAGS = ["p", TEXT_TAG, "li", "span", "text"];

export function collectAllText(node: StoryNode, join: string = "\n"): string {
  const texts: string[] = [];
  function walk(n: StoryNode) {
    if (TEXT_CONTENT_TAGS.includes(n.type)) {
      const trimmed = n.text.trim();
      if (trimmed) {
        texts.push(trimmed);
      }
    }
    for (const kid of n.kids) {
      walk(kid);
    }
  }
  walk(node);
  return texts.join(join);
}

export function cloneNode(node: StoryNode): StoryNode {
  return {
    addr: node.addr,
    type: node.type,
    atts: { ...node.atts },
    text: node.text,
    kids: node.kids.map((kid) => cloneNode(kid)),
  };
}

export function nodeToRenderedNode(
  node: StoryNode,
  state: Record<string, TSerial>,
  rng: PRNG
) {
  const rendered = { ...node };

  for (const [key, value] of Object.entries(node.atts)) {
    try {
      rendered.atts[key] = renderHandlebars(value, state, rng);
    } catch {
      rendered.atts[key] = value;
    }
  }

  if (!isBlank(node.text)) {
    try {
      rendered.text = renderHandlebars(node.text, state, rng);
    } catch {
      rendered.text = node.text;
    }
  }

  return rendered;
}

export function createEvent(
  from: string,
  body: string,
  to: string[] = [],
  obs: string[] = [],
  time: number = Date.now()
): StoryEvent {
  return { from, body, to, obs, time };
}

function assignInput(input: string, playthru: Playthru) {
  if (playthru.inputKey) {
    if (playthru.inputType) {
      playthru.state[playthru.inputKey] = cast(
        input,
        stringToCastType(playthru.inputType)
      );
      playthru.inputType = null; // Important to unset to clear for next advance()
    } else if (looksLikeBoolean(input)) {
      playthru.state[playthru.inputKey] = cast(input, "boolean");
    } else if (looksLikeNumber(input)) {
      playthru.state[playthru.inputKey] = cast(input, "number");
    } else {
      playthru.state[playthru.inputKey] = input;
    }
    playthru.inputKey = null; // Important to unset to clear for next advance()
  }
}

function getScope(playthru: Playthru): { [key: string]: TSerial } {
  const globalState = playthru.state;
  const currentScope =
    playthru.callStack.length > 0
      ? playthru.callStack[playthru.callStack.length - 1].scope
      : null;

  return new Proxy({} as { [key: string]: TSerial }, {
    get(target, prop: string) {
      // Check all scopes from most recent to oldest
      for (let i = playthru.callStack.length - 1; i >= 0; i--) {
        const scope = playthru.callStack[i].scope;
        if (prop in scope) {
          return scope[prop];
        }
      }
      // Fall back to global state
      return globalState[prop];
    },
    set(target, prop: string, value) {
      if (currentScope) {
        // Write to current block's scope
        currentScope[prop] = value;
      } else {
        // No active block, write to global state
        globalState[prop] = value;
      }
      return true;
    },
    has(target, prop: string) {
      // Check all scopes
      for (const entry of playthru.callStack) {
        if (prop in entry.scope) return true;
      }
      return prop in globalState;
    },
    ownKeys(target) {
      // Merge all keys from all scopes and global state
      const keys = new Set(Object.keys(globalState));
      for (const entry of playthru.callStack) {
        Object.keys(entry.scope).forEach((key) => keys.add(key));
      }
      return Array.from(keys);
    },
    getOwnPropertyDescriptor(target, prop: string) {
      // Needed for proper enumeration
      // Check all scopes first
      for (let i = playthru.callStack.length - 1; i >= 0; i--) {
        const scope = playthru.callStack[i].scope;
        if (prop in scope) {
          return {
            configurable: true,
            enumerable: true,
            value: scope[prop],
          };
        }
      }
      // Then check global state
      if (prop in globalState) {
        return {
          configurable: true,
          enumerable: true,
          value: globalState[prop],
        };
      }
    },
  });
}
