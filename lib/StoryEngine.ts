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
import {
  cleanSplit,
  cleanSplitRegex,
  isBlank,
  renderHandlebars,
} from "lib/TextHelpers";
import { isEmpty, omit } from "lodash";
import { TScalar } from "typings";
import { parseTaggedSpeakerLine } from "./DialogHelpers";
import { ServiceProvider } from "./ServiceProvider";
import { dumpTree } from "./TreeDumper";

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
  turn: number; // Current turn i.e. game step (used for PRNG too)
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

export function createDefaultPlaythru(id: string): Playthru {
  return {
    id,
    time: Date.now(),
    turn: 0,
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

export type PlayOptions = {
  mode: StepMode;
  verbose: boolean;
  seed: string;
  doGenerateSpeech: boolean;
  doGenerateSounds: boolean;
};

function shouldJsonify(a: any) {
  return Array.isArray(a) || (a && typeof a === "object");
}

let calls = 0;

export async function advance(
  provider: ServiceProvider,
  story: Story,
  playthru: Playthru,
  options: PlayOptions
) {
  function log(...args: any[]) {
    if (options.verbose) {
      console.info(
        chalk.gray(
          ...args.map((a) => (shouldJsonify(a) ? JSON.stringify(a) : a))
        )
      );
    }
  }

  const out: OP[] = [];

  const rng = new PRNG(options.seed, playthru.cycle % 10_000);
  playthru.time = Date.now();
  playthru.turn++;

  const sections = await compile(story.cartridge);

  if (calls++ < 1) {
    sections.forEach(({ path, root }) => {
      log(path, "::", dumpTree(root));
    });
  }

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
    const result = await handler.exec(context, provider);
    out.push(...result.ops);

    log(
      `<${node.tag} ${node.id}${node.tag.startsWith("h") ? ` "${node.text}"` : ""}${isEmpty(context.atts) ? "" : " " + JSON.stringify(context.atts)} ${result.flow}>`,
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
  options: PlayOptions;
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
  exec: (
    context: ActionContext,
    services: ServiceProvider
  ) => Promise<ActionResult>;
}

export const ACTION_HANDLERS: ActionHandler[] = [
  {
    match: (node) => node.tag === "root",
    exec: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.section, true),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node) => node.tag === "ul" || node.tag === "ol",
    exec: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.section, true),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: Node) => node.tag.startsWith("h"), // <h*>, <header>, <head>, <hr>
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) =>
      node.tag === "text" ||
      node.tag === "p" ||
      node.tag === "li" ||
      node.tag === "span",
    exec: async (ctx, provider) => {
      // Check if paragraph has children (like jump tags)
      const hasChildren =
        ctx.node.kids.length > 0 && ctx.node.kids.some((k) => k.tag !== "text");
      const next = hasChildren
        ? nextNode(ctx.node, ctx.section, true) // Enter children
        : nextNode(ctx.node, ctx.section, false); // Skip to next sibling
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
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => [
      "strong", "b", "em", "i", "u", "del", "s", "mark", "small", "sup", "sub", "a"
    ].includes(node.tag),
    exec: async (ctx) => {
      // For inline elements, we generally want to skip over them and continue with siblings
      // The text content will be handled by parent elements
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "input",
    exec: async (ctx) => {
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
    exec: async (ctx) => {
      let next;
      const conditionTrue = evalExpr(ctx.atts.cond, ctx.state, {}, ctx.rng);
      if (conditionTrue && ctx.node.kids.length > 0) {
        // Find first non-else child
        const firstNonElse = ctx.node.kids.find((k) => k.tag !== "else");
        if (firstNonElse) {
          next = { node: firstNonElse, section: ctx.section };
        } else {
          next = nextNode(ctx.node, ctx.section, false);
        }
      } else {
        // Look for else block
        const elseChild = ctx.node.kids.find((k) => k.tag === "else");
        if (elseChild && elseChild.kids.length > 0) {
          next = { node: elseChild.kids[0], section: ctx.section };
        } else {
          next = nextNode(ctx.node, ctx.section, false);
        }
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
    exec: async (ctx) => {
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
    match: (node: Node) => node.tag === "set",
    exec: async (ctx) => {
      ctx.state[ctx.atts.var ?? ctx.atts.to ?? ctx.atts.key] = evalExpr(
        ctx.atts.op ?? ctx.atts.value,
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
    match: (node: Node) => node.tag === "pre", // <pre> often wraps <code>, so this is necessary
    exec: async (ctx) => {
      // TODO: If we have text children, we might want to treat this like a <p> or <text>
      const hasChildren =
        ctx.node.kids.length > 0 && ctx.node.kids.some((k) => k.tag !== "text");
      const next = hasChildren
        ? nextNode(ctx.node, ctx.section, true) // Enter children
        : nextNode(ctx.node, ctx.section, false); // Skip to next sibling
      return {
        ops: [],
        next,
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "code",
    exec: async (ctx) => {
      const lines = cleanSplitRegex(ctx.text, /[;\n]/);
      lines.forEach((line) => {
        evalExpr(line, ctx.state, {}, ctx.rng);
      });
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: Node) => node.tag === "wait" || node.tag === "sleep",
    exec: async (ctx) => ({
      ops: [
        {
          type: "sleep",
          duration:
            parseNumberOrNull(
              ctx.atts.duration ?? ctx.atts.for ?? ctx.atts.ms
            ) ?? 1,
        },
      ],
      next: nextNode(ctx.node, ctx.section, false),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: Node) => node.tag === "block",
    exec: async (ctx) => ({
      ops: [],
      next: skipBlock(ctx.node, ctx.section),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: Node) => node.tag === "yield",
    exec: async (ctx) => {
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
  //
  //
  // -----
  //
  //
  {
    match: (node: Node) => node.tag === "llm",
    exec: async (ctx, provider) => {
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
    exec: async (ctx) => ({
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
    exec: async (ctx, provider) => {
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
    match: () => true,
    exec: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.section, false),
      flow: FlowType.CONTINUE,
    }),
  },
];
