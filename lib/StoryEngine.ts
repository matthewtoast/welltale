import dedent from "dedent";
import Handlebars from "handlebars";
import { castToString, evalExpr } from "lib/EvalUtils";
import { parseNumberOrNull } from "lib/MathHelpers";
import { PRNG } from "lib/RandHelpers";
import { dumpTree, StoryNode, TEXT_TAG } from "lib/StoryCompiler";
import {
  cleanSplit,
  cleanSplitRegex,
  DOLLAR,
  enhanceText,
  isBlank,
  LIQUID,
} from "lib/TextHelpers";
import { isEmpty, omit } from "lodash";
import { TSerial } from "typings";
import { z } from "zod";
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
  tags: z.array(z.string()),
});

export const PlaythruSchema = z.object({
  id: z.string(),
  time: z.number(),
  turn: z.number(),
  cycle: z.number(),
  loops: z.number(),
  address: z.string().nullable(),
  stash: z.record(z.any()),
  input: z.union([
    z.object({
      body: z.string(),
      props: z.record(z.any()),
      context: z.string(),
    }),
    z.null(),
  ]),
  callStack: z.array(
    z.object({
      returnAddress: z.string(),
      scope: z.record(z.any()),
    })
  ),
  state: z.record(z.any()),
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

export function createDefaultPlaythru(
  id: string,
  state: Record<string, TSerial> = {}
): Playthru {
  return {
    id,
    time: Date.now(),
    turn: 0,
    cycle: 0,
    loops: 0,
    address: null,
    input: null,
    callStack: [],
    stash: {},
    state,
    history: [],
  };
}

export interface Story {
  id: string;
  cartridge: Cartridge;
}

export type OP =
  | { type: "sleep"; duration: number }
  | { type: "get-input"; timeLimit: number | null }
  | { type: "play-media"; media: string }
  | { type: "play-event"; audio: string; event: StoryEvent }
  | { type: "story-end" };

export interface ActionContext {
  options: StoryOptions;
  main: StoryNode;
  root: StoryNode;
  node: StoryNode;
  playthru: Playthru;
  rng: PRNG;
  provider: ServiceProvider;
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
  exec: (context: ActionContext) => Promise<ActionResult>;
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

  if (!playthru.address) {
    playthru.address = main.addr;
  }

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

    const ctx: ActionContext = {
      options,
      main,
      root,
      node,
      playthru,
      rng,
      provider,
      // We need to get a new scope on every node since it may have introduced new scope
      scope: createScope(playthru),
    };

    if (playthru.input) {
      const { body, props, context } = playthru.input;
      playthru.input = null;
      const reserved = [
        "to",
        "obs",
        "tags",
        "value",
        "default",
        "placeholder",
        "type",
        "pattern",
        "min",
        "max",
        "minlength",
        "maxlength",
      ];
      const schema = {
        ...omit(props, ...reserved),
      };

      // const schema = {
      //   input: "[string] The full input, with typos corrected",
      //   sentiment: "[number] The sentiment, as a number in the range -1..1",
      //   valid: "[boolean] True if input was valid, false if not",
      //   ...omit(atts, "placeholder", "context"),
      // };
      const json = await provider.generateJson(
        dedent`
          Parse fields from the input per the schema.
          <input>${body}</input>
          If blank, fill in all fields with your best guess.
          Context: ${context}
        `,
        schema
      );
      playthru.history.push({
        from: PLAYER_ID,
        body,
        to: cleanSplit(props.to, ","),
        obs: cleanSplit(props.obs, ","),
        tags: cleanSplit(props.tags, ","),
        time: Date.now(),
      });
    }

    const handler = ACTION_HANDLERS.find((h) => h.match(node))!;
    const result = await handler.exec(ctx);
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

const TEXT_CONTENT_TAGS = [
  TEXT_TAG,
  "text",
  "p",
  "span",
  "b",
  "strong",
  "em",
  "i",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

export const DESCENDABLE_TAGS = [
  "root",
  "body",
  "div",
  "ul",
  "ol",
  "li",
  "section",
  "sec",
  "div",
  "pre",
];

export const ACTION_HANDLERS: ActionHandler[] = [
  {
    match: (node) => DESCENDABLE_TAGS.includes(node.type),
    exec: async (ctx) => {
      const next = nextNode(ctx.node, ctx.root, true);
      return {
        ops: [],
        next: next,
      };
    },
  },
  {
    match: (node: StoryNode) => TEXT_CONTENT_TAGS.includes(node.type),
    exec: async (ctx) => {
      const next = nextNode(ctx.node, ctx.root, false);
      const ops: OP[] = [];
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      let text = "";
      // If we have a ref tag, assume it refers to a <stash>
      if (atts.ref) {
        text = castToString(ctx.playthru.stash[atts.ref]);
      }
      if (isBlank(text)) {
        // Assume text nodes never contain actionable children, only text
        text = collectAllText(ctx.node);
      }
      // Early exit spurious empty nodes
      if (isBlank(text)) {
        return {
          ops,
          next,
        };
      }
      text = await renderText(text, ctx.scope, ctx.rng, ctx.provider);
      const event: StoryEvent = {
        body: ctx.rng.randomElement(cleanSplit(text, "|")),
        from: atts.from ?? atts.speaker ?? atts.voice ?? "",
        to: atts.to ? cleanSplit(atts.to, ",") : [PLAYER_ID],
        obs: atts.obs ? cleanSplit(atts.obs, ",") : [],
        tags: atts.tags ? cleanSplit(atts.tags, ",") : [],
        time: Date.now(),
      };
      const { url } = ctx.options.doGenerateSpeech
        ? await ctx.provider.generateSpeech(event)
        : { url: "" };
      ops.push({
        type: "play-event",
        audio: url,
        event,
      });
      ctx.playthru.history.push(event);
      return {
        ops,
        next,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "if",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      let next;
      const conditionTrue = evalExpr(atts.cond, ctx.scope, {}, ctx.rng);
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
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      let next;
      if (!atts.if || evalExpr(atts.if, ctx.scope, {}, ctx.rng)) {
        next = searchForNode(ctx.root, atts.to);
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
    match: (node: StoryNode) => node.type === "stash" || node.type === "var",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      const rollup = collectAllText(ctx.node);
      const value = !isBlank(rollup) ? rollup : atts.value;
      const key = atts.name ?? atts.var ?? atts.to ?? atts.key ?? atts.id;
      if (ctx.node.type === "stash") {
        ctx.playthru.stash[key] = value;
      } else {
        ctx.playthru.state[key] = value;
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "code",
    exec: async (ctx) => {
      const rollup = collectAllText(ctx.node);
      const text = await renderText(rollup, ctx.scope, ctx.rng, ctx.provider);
      const lines = cleanSplitRegex(text, /[;\n]/);
      lines.forEach((line) => {
        evalExpr(line, ctx.scope, {}, ctx.rng);
      });
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "wait" || node.type === "sleep",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      return {
        ops: [
          {
            type: "sleep",
            duration:
              parseNumberOrNull(atts.duration ?? atts.for ?? atts.ms) ?? 1,
          },
        ],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
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
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      const targetBlockId = atts.to;
      const returnToNodeId = atts.returnTo ?? atts.return;
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
      for (const [key, value] of Object.entries(atts)) {
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
    match: (node: StoryNode) => node.type === "sound" || node.type === "audio",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      let url = atts.href ?? atts.url ?? atts.src;
      const next = nextNode(ctx.node, ctx.root, false);
      const ops: OP[] = [];
      if (!url) {
        const rollup = collectAllText(ctx.node);
        const prompt = rollup ?? atts.prompt ?? atts.gen;
        if (!isBlank(prompt)) {
          const result = ctx.options.doGenerateSounds
            ? await ctx.provider.generateSound(prompt)
            : { url: "" };
          url = result.url;
        }
      }
      if (url) {
        ops.push({
          type: "play-media",
          media: url,
        });
      }
      return {
        ops,
        next,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      // Get additional prompt from node content
      const prompt = await renderText(
        collectAllText(ctx.node),
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      const result = await ctx.provider.generateJson(prompt, atts);
      for (const [key, value] of Object.entries(result)) {
        ctx.playthru.state[key] = value;
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) =>
      node.type === "input" || node.type === "textarea",
    exec: async (ctx) => {
      const next = nextNode(ctx.node, ctx.root, false);
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      const context = await renderText(
        collectAllText(ctx.node),
        ctx.scope,
        ctx.rng,
        ctx.provider
      );
      // Next advance() we'll assign input using these atts
      ctx.playthru.input = {
        body: "",
        props: { ...atts },
        context,
      };
      // If autoInput mode, just go into the next loop
      if (ctx.options.autoInput) {
        return {
          ops: [],
          next,
        };
      }
      // Otherwise return to client to collect actual user input
      return {
        ops: [
          {
            type: "get-input",
            timeLimit: parseNumberOrNull(atts.timeLimit ?? atts.for),
          },
        ],
        next,
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

export function createScope(playthru: Playthru): { [key: string]: TSerial } {
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

export async function renderText(
  text: string,
  scope: Record<string, TSerial>,
  rng: PRNG | null,
  provider: ServiceProvider | null
): Promise<string> {
  let result = Handlebars.compile(text)(scope);
  if (rng) {
    result = await enhanceText(
      result,
      async (chunk: string) => {
        return castToString(evalExpr(chunk, scope, {}, rng));
      },
      DOLLAR
    );
  }
  if (provider) {
    result = await enhanceText(
      result,
      async (chunk: string) => {
        return await provider.generateText(chunk);
      },
      LIQUID
    );
  }
  return result;
}

export async function renderAtts(
  atts: Record<string, string>,
  scope: Record<string, TSerial>,
  rng: PRNG | null,
  provider: ServiceProvider | null
) {
  const out: Record<string, string> = {};
  for (const key in atts) {
    if (typeof atts[key] === "string") {
      out[key] = await renderText(atts[key], scope, rng, provider);
    }
  }
  return out;
}
