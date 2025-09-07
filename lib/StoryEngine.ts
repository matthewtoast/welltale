import chalk from "chalk";
import Handlebars from "handlebars";
import {
  castToString,
  castToTypeEnhanced,
  evalExpr,
  isTruthy,
} from "lib/EvalUtils";
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
import { get, isEmpty, omit, set } from "lodash";
import { NonEmpty, TSerial } from "typings";
import { z } from "zod";
import { MODELS } from "./OpenRouterUtils";
import { GenerateOptions, ServiceProvider } from "./ServiceProvider";

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

export const SessionSchema = z.object({
  id: z.string(),
  time: z.number(),
  turn: z.number(),
  cycle: z.number(),
  loops: z.number(),
  resume: z.boolean(),
  address: z.string().nullable(),
  input: z.union([
    z.object({
      body: z.string(),
      atts: z.record(z.any()),
    }),
    z.null(),
  ]),
  stack: z.array(
    z.object({
      returnAddress: z.string(),
      scope: z.record(z.any()),
      blockType: z.enum(["scope", "yield", "intro", "resume"]).optional(),
    })
  ),
  state: z.record(z.any()),
  history: z.array(StoryEventSchema),
  meta: z.record(z.any()),
  cache: z.record(z.any()),
  genie: z.record(z.union([z.instanceof(Buffer), z.string()])).optional(),
});

const ModelSchema = z.enum(MODELS as any);

export const StoryOptionsSchema = z.object({
  verbose: z.boolean(),
  seed: z.string(),
  loop: z.number(),
  ream: z.number(),
  doGenerateSpeech: z.boolean(),
  doGenerateAudio: z.boolean(),
  models: z
    .tuple([ModelSchema, ModelSchema])
    .rest(ModelSchema)
    .transform((val) => val as NonEmpty<(typeof MODELS)[number]>),
});

export type StoryEvent = z.infer<typeof StoryEventSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type StoryOptions = z.infer<typeof StoryOptionsSchema>;

export function createDefaultSession(
  id: string,
  state: Record<string, TSerial> = {},
  meta: Record<string, TSerial> = {}
): Session {
  return {
    id,
    time: Date.now(),
    turn: 0,
    cycle: 0,
    loops: 0,
    resume: false,
    address: null,
    input: null,
    stack: [],
    state,
    meta,
    cache: {},
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
  origin: StoryNode;
  root: StoryNode;
  node: StoryNode;
  session: Session;
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
  session: Session,
  options: StoryOptions
): Promise<{
  ops: OP[];
  session: Session;
  seam: SeamType;
  info: Record<string, string>;
}> {
  const out: OP[] = [];

  const rng = new PRNG(options.seed, session.cycle % 10_000);
  session.time = Date.now();
  session.turn += 1;

  if (calls++ < 1) {
    if (options.verbose) {
      console.info(chalk.gray(dumpTree(root)));
    }
  }

  // The origin (if present) is the node the author wants to treat as the de-facto beginning of playback
  const origin = findNodes(root, (node) => node.type === "origin")[0] ?? root;

  // Extract metadata on first turn
  if (session.turn === 1) {
    findNodes(root, (node) => node.type === "meta").forEach((meta) => {
      if (!isBlank(meta.atts.description)) {
        session.meta[meta.atts.name ?? meta.atts.property] =
          meta.atts.description;
      }
    });
  }

  // Check for resume first (takes precedence over intro)
  if (session.resume) {
    session.resume = false;
    const resume = findNodes(root, (node) => node.type === "resume")[0];
    if (resume) {
      session.stack.push({
        returnAddress: session.address || origin.addr,
        scope: {},
        blockType: "resume",
      });
      session.address = resume.addr;
    } else if (!session.address) {
      session.address = origin.addr;
    }
  } else if (session.turn === 1) {
    // Check for intro on first turn (only if not resuming)
    const intro = findNodes(root, (node) => node.type === "intro")[0];
    if (intro) {
      session.stack.push({
        returnAddress: origin.addr,
        scope: {},
        blockType: "intro",
      });
      session.address = intro.addr;
    } else {
      session.address = origin.addr;
    }
  } else if (!session.address) {
    session.address = origin.addr;
  }

  function done(seam: SeamType, info: Record<string, string>) {
    session.cycle = rng.cycle;
    return { ops: out, session, seam, info };
  }

  const visits: Record<string, number> = {};
  let iterations = 0;

  while (true) {
    let node: StoryNode | null =
      findNodes(root, (node) => node.addr === session.address)[0] ?? null;

    if (!node) {
      const error = `Node ${session.address} not found`;
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
      origin,
      root,
      node,
      session,
      rng,
      provider,
      // We need to get a new scope on every node since it may have introduced new scope
      scope: createScope(session),
    };

    if (session.input) {
      const { body, atts } = session.input;
      if (atts.var) {
        setState(ctx.scope, atts.var, body);
      }
      session.input = null;
      session.history.push({
        from: PLAYER_ID,
        body,
        to: cleanSplit(atts.to, ","),
        obs: cleanSplit(atts.obs, ","),
        tags: cleanSplit(atts.tags, ","),
        time: Date.now(),
      });
    }

    const handler = ACTION_HANDLERS.find((h) => h.match(node))!;
    const result = await handler.exec(ctx);
    out.push(...result.ops);

    if (options.verbose) {
      console.info(
        chalk.gray(
          `<${node.type} ${node.addr}${isEmpty(node.atts) ? "" : " " + JSON.stringify(node.atts)}> ~> ${result.next?.node.addr} ${JSON.stringify(result.ops)}`
        )
      );
    }

    if (result.next) {
      // Check if we're currently in a yielded block and the next node escapes it
      if (
        session.stack.length > 0 &&
        wouldEscapeCurrentBlock(node, result.next.node, root)
      ) {
        // Pop from callstack instead of using the next node
        const { returnAddress } = session.stack.pop()!;
        session.address = returnAddress;
      } else {
        session.address = result.next.node.addr;
      }
    } else {
      // No next node - check if we should return from a block
      if (session.stack.length > 0) {
        const { returnAddress } = session.stack.pop()!;
        session.address = returnAddress;
      } else {
        if (session.loops < options.loop) {
          session.loops += 1;
          session.address = null;
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
  "html",
  "body",
  "div",
  "ul",
  "ol",
  "li",
  "section",
  "sec",
  "pre",
  "scope",
  "origin",
  // Common HTML tags we'll treat as playable content
  "main",
  "aside",
  "article",
  "details",
  "summary",
];

export const LOOP_TAGS = ["while"];

export const ACTION_HANDLERS: ActionHandler[] = [
  {
    match: (node) => node.type === "scope",
    exec: async (ctx) => {
      // Push a new scope onto the callStack when entering
      const returnAddress =
        nextNode(ctx.node, ctx.root, false)?.node.addr ?? ctx.origin.addr;
      ctx.session.stack.push({
        returnAddress,
        scope: {},
        blockType: "scope",
      });
      // Enter the scope (process children)
      const next =
        ctx.node.kids.length > 0
          ? { node: ctx.node.kids[0] }
          : nextNode(ctx.node, ctx.root, false);
      return {
        ops: [],
        next,
      };
    },
  },
  {
    match: (node) =>
      DESCENDABLE_TAGS.includes(node.type) && node.type !== "scope",
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
        ctx.provider,
        ctx.options.models
      );
      let text = "";
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
      text = await renderText(
        text,
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
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
      ctx.session.history.push(event);
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
        ctx.provider,
        ctx.options.models
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
    match: (node: StoryNode) => node.type === "while",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
      let next;
      const conditionTrue = evalExpr(atts.cond, ctx.scope, {}, ctx.rng);
      if (conditionTrue && ctx.node.kids.length > 0) {
        next = nextNode(ctx.node, ctx.root, true);
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
    match: (node: StoryNode) => node.type === "jump",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
      let next;
      if (!atts.if || evalExpr(atts.if, ctx.scope, {}, ctx.rng)) {
        next = searchForNode(
          ctx.root,
          atts.to ?? atts.target ?? atts.destination
        );
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
    match: (node: StoryNode) => node.type === "var",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
      const key = atts.name ?? atts.var ?? atts.key ?? atts.id;
      let rollup = collectAllText(ctx.node);
      if (!isBlank(atts.stash)) {
        rollup = await renderText(
          rollup,
          ctx.scope,
          ctx.rng,
          ctx.provider,
          ctx.options.models
        );
      }
      const value = !isBlank(rollup) ? rollup : atts.value;
      setState(ctx.scope, key, value);
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "code",
    exec: async (ctx) => {
      const text = await renderText(
        collectAllText(ctx.node),
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
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
    match: (node: StoryNode) => node.type === "sleep",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
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
    // Intro nodes process their children like any container
    match: (node: StoryNode) => node.type === "intro",
    exec: async (ctx) => {
      const next = nextNode(ctx.node, ctx.root, true);
      return { ops: [], next };
    },
  },
  {
    // Resume nodes are processed only when explicitly resuming, otherwise skipped
    match: (node: StoryNode) => node.type === "resume",
    exec: async (ctx) => {
      // Check if we're in a resume context
      const inResumeContext = ctx.session.stack.some(
        (frame) => frame.blockType === "resume"
      );

      if (inResumeContext) {
        // Process children when actually resuming
        const next =
          ctx.node.kids.length > 0
            ? { node: ctx.node.kids[0] }
            : nextNode(ctx.node, ctx.root, false);
        return { ops: [], next };
      } else {
        // Skip resume block in normal flow
        return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
      }
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
        ctx.provider,
        ctx.options.models
      );
      const targetBlockId = atts.target;
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
          returnAddress = next?.node.addr ?? ctx.origin.addr;
        }
      } else {
        const next = nextNode(ctx.node, ctx.root, false);
        returnAddress = next?.node.addr ?? ctx.origin.addr;
      }
      const scope: { [key: string]: TSerial } = {};
      for (const [key, value] of Object.entries(
        omit(atts, "to", "return", "returnTo")
      )) {
        setState(scope, key, value);
      }
      ctx.session.stack.push({
        returnAddress,
        scope,
        blockType: "yield",
      });
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
    match: (node: StoryNode) =>
      node.type === "sound" ||
      node.type === "audio" ||
      node.type === "music" ||
      node.type === "speech" ||
      node.type === "voice",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
      let url = atts.href ?? atts.url ?? atts.src;
      const next = nextNode(ctx.node, ctx.root, false);
      const ops: OP[] = [];
      if (!url) {
        const rollup = await renderText(
          collectAllText(ctx.node),
          ctx.scope,
          ctx.rng,
          ctx.provider,
          ctx.options.models
        );
        const prompt = !isBlank(rollup) ? rollup : atts.make;
        if (!isBlank(prompt)) {
          if (ctx.options.doGenerateAudio) {
            switch (ctx.node.type) {
              case "sound":
              case "audio":
                const audio = await ctx.provider.generateSound(prompt);
                url = audio.url;
                break;
              case "music":
                const music = await ctx.provider.generateMusic(prompt);
                url = music.url;
                break;
              case "speech":
              case "voice":
                const voice = await ctx.provider.generateSpeech({
                  from: atts.voice ?? atts.from ?? atts.speaker,
                  body: prompt,
                });
                url = voice.url;
                break;
              default:
                url = "";
                break;
            }
          } else {
            url = "";
          }
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
    match: (node: StoryNode) => node.type === "make",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
      // Get additional prompt from node content
      const prompt = await renderText(
        collectAllText(ctx.node),
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const generateOptions: GenerateOptions = {
        models: ctx.options.models,
        useWebSearch,
      };
      const result = await ctx.provider.generateJson(
        prompt,
        atts,
        generateOptions
      );
      for (const [key, value] of Object.entries(result)) {
        setState(ctx.scope, key, value);
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
        ctx.provider,
        ctx.options.models
      );
      // Next advance() we'll assign input using these atts
      ctx.session.input = {
        body: "",
        atts,
      };
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
    match: (node) => node.type === "log",
    exec: async (ctx) => {
      const atts = await renderAtts(
        ctx.node.atts,
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
      const rollup = await renderText(
        collectAllText(ctx.node),
        ctx.scope,
        ctx.rng,
        ctx.provider,
        ctx.options.models
      );
      const message = !isBlank(rollup) ? rollup : atts.message;
      if (message) {
        console.info(atts.message);
      }
      if (!message || atts.dump) {
        console.dir(
          {
            atts,
            session: omit(ctx.session, "history"),
            options: ctx.options,
            scope: ctx.scope,
          },
          {
            depth: null,
            colors: true,
          }
        );
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

export function publicAtts<T extends Record<string, any>>(atts: T): T {
  const out: Record<string, any> = {};
  for (const key in atts) {
    if (!key.startsWith("$") && !key.startsWith("_")) {
      out[key] = atts[key];
    }
  }
  return out as T;
}

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
  if (!parent) {
    return null;
  }
  const siblingIndex = parent.kids.findIndex((k) => k.addr === curr.addr);
  if (siblingIndex >= 0 && siblingIndex < parent.kids.length - 1) {
    return { node: parent.kids[siblingIndex + 1] };
  }
  if (LOOP_TAGS.includes(parent.type)) {
    return { node: parent };
  }
  // No more siblings, recurse up the tree
  return nextNode(parent, root, false);
}

export function parentNodeOf(
  node: StoryNode,
  root: StoryNode
): StoryNode | null {
  if (node.addr === root.addr) return null;
  return (
    findNodes(root, (n) => {
      return n.kids.some((k) => k.addr === node.addr);
    })[0] ?? null
  );
}

export function wouldEscapeCurrentBlock(
  currentNode: StoryNode,
  nextNode: StoryNode,
  root: StoryNode
): boolean {
  // Find the closest container ancestor that uses the stack
  let node: StoryNode | null = currentNode;
  let blockAncestor: StoryNode | null = null;

  while (node) {
    if (
      node.type === "block" ||
      node.type === "scope" ||
      node.type === "intro" ||
      node.type === "resume"
    ) {
      blockAncestor = node;
      break;
    }
    node = parentNodeOf(node, root);
  }

  if (!blockAncestor) {
    return false;
  }

  // Check if next node would escape the current container
  const blockPrefix = blockAncestor.addr + ".";
  return !nextNode.addr.startsWith(blockPrefix);
}

function getState(state: Record<string, TSerial>, key: string): TSerial {
  return get(state, key);
}
function setState(
  state: Record<string, TSerial>,
  key: string,
  value: TSerial
): void {
  set(state, key, value);
}

export function walkTree<T>(
  node: StoryNode,
  visitor: (node: StoryNode, parent: StoryNode | null) => T | null,
  parent: StoryNode | null = null
): T | null {
  const result = visitor(node, parent);
  if (result !== null && result !== undefined) return result;
  for (let i = 0; i < node.kids.length; i++) {
    const childResult = walkTree(node.kids[i], visitor, node);
    if (childResult !== null && childResult !== undefined) return childResult;
  }
  return null;
}

export function searchForNode(
  root: StoryNode,
  term: string | null | undefined
): { node: StoryNode } | null {
  if (!term || isBlank(term)) {
    return null;
  }
  const found = walkTree(root, (node) => (node.atts.id === term ? node : null));
  return found ? { node: found } : null;
}

export function findNodes(
  root: StoryNode,
  predicate: (node: StoryNode, parent: StoryNode | null) => boolean
): StoryNode[] {
  const results: StoryNode[] = [];
  walkTree(
    root,
    (node, parent) => {
      if (predicate(node, parent)) {
        results.push(node);
      }
      return null;
    },
    null
  );
  return results;
}

export function collectAllText(node: StoryNode, join: string = "\n"): string {
  const texts: string[] = [];
  walkTree(node, (n) => {
    if (TEXT_CONTENT_TAGS.includes(n.type)) {
      const trimmed = n.text.trim();
      if (trimmed) {
        texts.push(trimmed);
      }
    }
    return null;
  });
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

async function processInputValue(
  raw: string,
  atts: Record<string, TSerial>,
  ctx: ActionContext
): Promise<{ success: boolean; value?: TSerial; errorMessage?: string }> {
  let value: TSerial = raw;

  // 1. AI Enhancement
  if (atts.make) {
    const enhanced = await ctx.provider.generateJson(
      `Given user input "${value}", return a value that matches: ${atts.make}`,
      { input: value, type: atts.type, pattern: atts.pattern },
      { models: ctx.options.models, useWebSearch: false }
    );
    value = enhanced.value || value;
  }

  // 2. Pattern Validation
  if (atts.pattern) {
    const pattern = castToString(atts.pattern);
    if (!new RegExp(pattern).test(castToString(value))) {
      const errorMessage = atts.error
        ? castToString(atts.error)
        : "Invalid format";
      return { success: false, errorMessage };
    }
  }

  // 3. Parse Expression (using existing evalExpr)
  if (atts.parse) {
    value = evalExpr(
      castToString(atts.parse),
      { ...ctx.scope, input: value },
      {},
      ctx.rng
    );
  }

  // 4. Type Casting (new enhanced function)
  value = castToTypeEnhanced(value, castToString(atts.type));

  // Validate result isn't null/undefined unless explicitly allowed
  if (value === null || value === undefined) {
    // 5. Default Fallback
    if (atts.default !== undefined) {
      const defaultValue = castToTypeEnhanced(
        atts.default,
        castToString(atts.type)
      );
      return { success: true, value: defaultValue };
    }

    const errorMessage = atts.error
      ? castToString(atts.error)
      : "Please provide a valid input and try again.";
    return { success: false, errorMessage };
  }

  return { success: true, value };
}

export function createScope(session: Session): { [key: string]: TSerial } {
  const globalState = session.state;

  const currentScope =
    session.stack.length > 0
      ? session.stack[session.stack.length - 1].scope
      : null;

  return new Proxy({} as { [key: string]: TSerial }, {
    get(target, prop: string) {
      for (let i = session.stack.length - 1; i >= 0; i--) {
        const scope = session.stack[i].scope;
        if (prop in scope) {
          return scope[prop];
        }
      }
      // Return null here instead of undefined so we can reference unknown vars in evalExpr w/o throwing
      return globalState[prop] ?? ({ session } as any)[prop] ?? null;
    },
    set(target, prop: string, value) {
      if (currentScope) {
        currentScope[prop] = value;
      } else {
        globalState[prop] = value;
      }
      return true;
    },
    getOwnPropertyDescriptor(target, prop: string) {
      // Check all scopes first
      for (let i = session.stack.length - 1; i >= 0; i--) {
        const scope = session.stack[i].scope;
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
  provider: ServiceProvider | null,
  models: NonEmpty<(typeof MODELS)[number]>
): Promise<string> {
  if (isBlank(text) || text.length < 3) {
    return text;
  }
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
        return await provider.generateText(chunk, {
          models,
          useWebSearch: false,
        });
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
  provider: ServiceProvider | null,
  models: NonEmpty<(typeof MODELS)[number]>
) {
  const out: Record<string, string> = {};
  for (const key in atts) {
    if (typeof atts[key] === "string") {
      out[key] = await renderText(atts[key], scope, rng, provider, models);
    }
  }
  return out;
}
