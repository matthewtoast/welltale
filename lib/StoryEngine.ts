import chalk from "chalk";
import {
  cast,
  evalExpr,
  looksLikeBoolean,
  looksLikeNumber,
  stringToCastType,
} from "lib/EvalUtils";
import { parseNumberOrNull } from "lib/MathHelpers";
import {
  findNode,
  markdownToTree,
  nextNode,
  Node,
  searchNode,
  Section,
  skipBlock,
} from "lib/NodeHelpers";
import { PRNG } from "lib/RandHelpers";
import { cleanSplit, isBlank, renderHandlebars } from "lib/TextHelpers";
import { omit } from "lodash";
import { TScalar } from "typings";
import { parseTaggedSpeakerLine } from "./DialogHelpers";
import { ServiceProvider } from "./ServiceProvider";

export const DEFAULT_SECTION = "main.md";
export const DEFAULT_CURSOR = "0";
export const PLAYER_ID = "USER";
export const FALLBACK_SPEAKER = "HOST";

export enum StepMode {
  SINGLE = "single",
  UNTIL_WAITING = "until_waiting",
  UNTIL_BLOCKING = "until_blocking",
}

export type Cartridge = Record<string, Buffer | string>;

export interface Playthru {
  id: string;
  time: number; // Real-world Unix time of current game step
  turn: number; // Current turn i.e. game step
  seed: string; // Seed value for PRNG
  cycle: number; // Cycle value for PRNG (to resume at previous point)
  state: {
    // Protected
    __section: string;
    __cursor: string;
    __inputKey: string;
    __inputType: null | string;
    __callStack: string[];
    // Public
    input: string;
    [key: string]: TScalar | TScalar[];
  };
  history: StoryEvent[];
  genie?: Cartridge; // Like Game Genie we can monkeypatch the cartridge
}

export type StoryEvent = {
  time: number;
  from: string;
  to: string[];
  obs: string[];
  body: string;
};

export function createEvent(
  from: string,
  body: string,
  to: string[] = [],
  obs: string[] = [],
  time: number = Date.now()
): StoryEvent {
  return { from, body, to, obs, time };
}

export function createDefaultPlaythru(
  id: string,
  seed: string = Math.random().toString(36).slice(2)
): Playthru {
  return {
    id,
    time: Date.now(),
    turn: 0,
    seed,
    cycle: 0,
    state: {
      input: "",
      __section: DEFAULT_SECTION,
      __cursor: DEFAULT_CURSOR,
      __inputKey: "input",
      __inputType: "string",
      __callStack: [],
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
  | { type: "end" };

export type AdvanceOptions = {
  mode: StepMode;
  verbose: boolean;
  doGenerateSpeech: boolean;
  doGenerateSounds: boolean;
};

function shouldJsonify(a: any) {
  return Array.isArray(a) || (a && typeof a === "object");
}

export async function advance(
  provider: ServiceProvider,
  story: Story,
  playthru: Playthru,
  options: AdvanceOptions
) {
  function log(...args: any[]) {
    if (options.verbose) {
      console.info(
        chalk.gray(
          ...args.map((a) =>
            shouldJsonify(a) ? JSON.stringify(a, null, 2) : a
          )
        )
      );
    }
  }

  const out: OP[] = [];

  const rng = new PRNG(playthru.seed, playthru.cycle % 10_000);
  playthru.time = Date.now();
  playthru.turn++;

  const sections = await compile(story.cartridge);
  const { state } = playthru;

  if (state.__inputType) {
    state[state.__inputKey] = cast(
      state.input,
      stringToCastType(state.__inputType)
    );
    state.__inputType = null; // Important to unset to clear for next advance()
  } else if (looksLikeBoolean(state.input)) {
    state[state.__inputKey] = cast(state.input, "boolean");
  } else if (looksLikeNumber(state.input)) {
    state[state.__inputKey] = cast(state.input, "number");
  } else {
    state[state.__inputKey] = state.input;
  }

  if (!isBlank(state.input)) {
    playthru.history.push(createEvent(PLAYER_ID, state.input));
  }

  log(`ADV`, story.id, state.input, options.mode, omit(playthru, "history"));

  while (true) {
    let section = sections.find((s) => s.path === state.__section);
    if (!section) {
      console.warn(`Section ${state.__section} not found`);
      break;
    }
    let node: Node | null = section
      ? findNode(section.root, (n) => n.id === state.__cursor)
      : null;
    if (!node) {
      console.warn(`Node ${state.__cursor} not found in ${section.path}`);
      break;
    }

    const { atts, text } = node;

    // Create renderedAtts by applying handlebars and evalExpr to all attribute values
    const renderedAttributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(atts)) {
      try {
        renderedAttributes[key] = renderHandlebars(value, state, rng);
      } catch {
        renderedAttributes[key] = value;
      }
    }

    // Create renderedText by applying handlebars rendering
    let renderedText = "";
    if (typeof text === "string" && !isBlank(text)) {
      try {
        renderedText = renderHandlebars(text, state, rng);
      } catch {
        renderedText = text;
      }
    }

    const context: ActionContext = {
      options,
      node,
      section,
      sections,
      state,
      playthru,
      rng,
      atts: renderedAttributes,
      text: renderedText,
    };

    const handler = ACTION_HANDLERS.find((h) => h.match(node))!;
    const result = await handler.execute(context, provider);
    out.push(...result.ops);

    log(
      `<${node.tag} ${node.id} ${section.path}>${renderedText}</> (${result.flow})`,
      result.ops
    );

    // Update cursor position
    if (result.next) {
      state.__cursor = result.next.node.id;
      state.__section = result.next.section.path;
    } else {
      // No next node - check if we should return from a block
      if (state.__callStack.length > 0) {
        const frame = state.__callStack.pop()!;
        const [returnSection, returnCursor] = frame.split("/");
        state.__cursor = returnCursor;
        state.__section = returnSection;
      } else {
        out.push({ type: "end" });
        break;
      }
    }

    if (result.flow === FlowType.BLOCKING) {
      break;
    }

    if (options.mode === StepMode.SINGLE) {
      break;
    }

    if (
      options.mode === StepMode.UNTIL_WAITING &&
      result.flow === FlowType.WAITING
    ) {
      break;
    }

    if (
      options.mode === StepMode.UNTIL_BLOCKING &&
      result.flow !== FlowType.CONTINUE
    ) {
      break;
    }
  }

  playthru.cycle = rng.cycle;

  log("DONE", omit(playthru, "history"), out);

  return out;
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

export interface ActionContext {
  options: AdvanceOptions;
  node: Node;
  section: Section;
  sections: Section[];
  state: Playthru["state"];
  playthru: Playthru;
  rng: PRNG;
  atts: Record<string, string>;
  text: string;
}

export enum FlowType {
  CONTINUE = "continue",
  BLOCKING = "blocking",
  WAITING = "waiting",
}

export interface ActionResult {
  ops: OP[];
  next: { node: Node; section: Section } | null;
  flow: FlowType;
}

interface ActionHandler {
  match: (node: Node) => boolean;
  execute: (
    context: ActionContext,
    services: ServiceProvider
  ) => Promise<ActionResult>;
}

export const ACTION_HANDLERS: ActionHandler[] = [
  {
    match: (node) => node.tag === "root",
    execute: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.section, true),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: Node) => node.tag.startsWith("h"), // <h*>, <header>, <head>, <hr>
    execute: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "text" || node.tag === "p",
    execute: async (ctx, provider) => {
      const next = nextNode(ctx.node, ctx.section, false);
      const ops: OP[] = [];
      // Skip spurious empty nodes
      if (isBlank(ctx.text)) {
        return {
          ops,
          next,
          flow: FlowType.CONTINUE,
        };
      }
      const line = parseTaggedSpeakerLine(ctx.text);
      const { url } = ctx.options.doGenerateSpeech
        ? await provider.generateSpeech(line)
        : { url: "" };
      ops.push({
        type: "play-line",
        audio: url,
        speaker: line.speaker,
        line: line.line,
      });
      const to: string[] = ctx.node.atts["to"]
        ? cleanSplit(ctx.node.atts["to"], ",")
        : [PLAYER_ID];
      const obs: string[] = ctx.node.atts["obs"]
        ? cleanSplit(ctx.node.atts["to"], ",")
        : [];
      ctx.playthru.history.push(createEvent(line.speaker, line.line, to, obs));
      return {
        ops,
        next,
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "input",
    execute: async (ctx) => {
      const toKey = ctx.atts.to;
      if (toKey) {
        ctx.state.__inputKey = toKey;
      }
      const castType = ctx.atts.as ?? ctx.atts.cast ?? ctx.atts.type;
      if (castType) {
        ctx.state.__inputType = castType;
      }
      return {
        ops: [
          {
            type: "get-input",
            timeLimit: parseNumberOrNull(ctx.atts.timeLimit ?? ctx.atts.for),
            charLimit: parseNumberOrNull(ctx.atts.charLimit),
          },
        ],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.WAITING,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "if",
    execute: async (ctx) => {
      let next;
      if (
        ctx.node.kids.length > 0 &&
        evalExpr(ctx.atts.cond, ctx.state, {}, ctx.rng)
      ) {
        console.log(222);
        next = { node: ctx.node.kids[0], section: ctx.section };
      } else {
        next = nextNode(ctx.node, ctx.section, false);
        console.log(333, next);
      }
      return {
        ops: [],
        next,
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "jump",
    execute: async (ctx) => {
      let next;
      if (!ctx.atts.if || evalExpr(ctx.atts.if, ctx.state, {}, ctx.rng)) {
        next = searchNode(ctx.sections, ctx.section, ctx.atts.to);
      } else {
        next = nextNode(ctx.node, ctx.section, false);
      }
      return {
        ops: [],
        next,
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "llm",
    execute: async (ctx, provider) => {
      let schema = ctx.atts.to ?? ctx.atts.schema;
      if (isBlank(schema)) {
        schema = "_"; // Assigns to the _ variable
      }
      const prompt = ctx.text ?? ctx.atts.prompt;
      if (!isBlank(prompt)) {
        const result = await provider.generateJson(prompt, schema);
        Object.assign(ctx.state, result);
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.BLOCKING,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "sound" && !!node.atts.url,
    execute: async (ctx) => ({
      ops: [
        {
          type: "play-sound",
          audio: ctx.atts.url,
        },
      ],
      next: nextNode(ctx.node, ctx.section, false),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: Node) => node.tag === "sound" && !!node.atts.gen,
    execute: async (ctx, provider) => {
      const prompt = ctx.text ?? ctx.atts.prompt ?? "";
      if (!isBlank(prompt)) {
        const { url } = ctx.options.doGenerateSounds
          ? await provider.generateSound(prompt)
          : { url: "" };
        return {
          ops: [{ type: "play-sound", audio: url }],
          next: nextNode(ctx.node, ctx.section, false),
          flow: FlowType.BLOCKING,
        };
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.BLOCKING,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "wait",
    execute: async (ctx) => ({
      ops: [
        {
          type: "sleep",
          duration: parseNumberOrNull(ctx.atts.duration ?? ctx.atts.for) ?? 1,
        },
      ],
      next: nextNode(ctx.node, ctx.section, false),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: Node) => node.tag === "case",
    execute: async (ctx) => {
      // Find first when child where cond is true
      for (const child of ctx.node.kids) {
        if (child.tag === "when") {
          const condAttr = child.atts.cond;
          // No condition means default case (always true)
          if (!condAttr || evalExpr(condAttr, ctx.state, {}, ctx.rng)) {
            // Jump to the first child of when (if any), otherwise next sibling
            if (child.kids.length > 0) {
              return {
                ops: [],
                next: { node: child.kids[0], section: ctx.section },
                flow: FlowType.CONTINUE,
              };
            } else {
              return {
                ops: [],
                next: nextNode(child, ctx.section, false),
                flow: FlowType.CONTINUE,
              };
            }
          }
        }
      }
      // No matching when - skip entire case block
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "when",
    execute: async (ctx) => {
      // When encountered directly (not via case), check condition
      const condAttr = ctx.atts.cond;
      if (!condAttr || evalExpr(condAttr, ctx.state, {}, ctx.rng)) {
        // Process children normally
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, true),
          flow: FlowType.CONTINUE,
        };
      } else {
        // Skip to next sibling
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, false),
          flow: FlowType.CONTINUE,
        };
      }
    },
  },
  {
    match: (node: Node) => node.tag === "set",
    execute: async (ctx) => {
      ctx.state[ctx.atts.var ?? ctx.atts.to] = evalExpr(
        ctx.atts.op,
        ctx.state,
        {},
        ctx.rng
      );
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "code",
    execute: async (ctx) => {
      evalExpr(ctx.text, ctx.state, {}, ctx.rng);
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "block",
    execute: async (ctx) => ({
      ops: [],
      next: skipBlock(ctx.node, ctx.section),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: Node) => node.tag === "yield",
    execute: async (ctx) => {
      const targetBlockId = ctx.atts.to;
      const returnTo = ctx.atts.returnTo;
      if (!targetBlockId) {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, false),
          flow: FlowType.CONTINUE,
        };
      }
      // Find the target block
      const blockResult = searchNode(ctx.sections, ctx.section, targetBlockId);
      if (!blockResult || blockResult.node.tag !== "block") {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, false),
          flow: FlowType.CONTINUE,
        };
      }
      // Determine return address
      let returnSection: string;
      let returnCursor: string;
      if (returnTo) {
        const returnResult = searchNode(ctx.sections, ctx.section, returnTo);
        if (returnResult) {
          returnSection = returnResult.section.path;
          returnCursor = returnResult.node.id;
        } else {
          const next = nextNode(ctx.node, ctx.section, false);
          returnSection = next?.section.path ?? DEFAULT_SECTION;
          returnCursor = next?.node.id ?? DEFAULT_CURSOR;
        }
      } else {
        const next = nextNode(ctx.node, ctx.section, false);
        returnSection = next?.section.path ?? DEFAULT_SECTION;
        returnCursor = next?.node.id ?? DEFAULT_CURSOR;
      }
      ctx.state.__callStack.push(`${returnSection}/${returnCursor}`);
      // Go to first child of block (or next sibling if no children)
      if (blockResult.node.kids.length > 0) {
        return {
          ops: [],
          next: {
            node: blockResult.node.kids[0],
            section: blockResult.section,
          },
          flow: FlowType.CONTINUE,
        };
      } else {
        return {
          ops: [],
          next: nextNode(blockResult.node, blockResult.section, false),
          flow: FlowType.CONTINUE,
        };
      }
    },
  },
  {
    match: (node: Node) => node.tag === "stop",
    execute: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.section, false),
      flow: FlowType.BLOCKING,
    }),
  },
  {
    match: () => true,
    execute: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.section, false),
      flow: FlowType.CONTINUE,
    }),
  },
];
