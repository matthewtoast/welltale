import { evalExpr } from "lib/EvalUtils";
import { parseNumberOrNull } from "lib/MathHelpers";
import {
  findNode,
  nextNode,
  Node,
  parseMarkdownToSection,
  searchNode,
  Section,
  skipBlock,
} from "lib/NodeHelpers";
import { PRNG } from "lib/RandHelpers";
import { isBlank, renderHandlebars } from "lib/TextHelpers";
import { TScalar } from "typings";
import { parseTaggedSpeakerLine } from "./DialogHelpers";
import { ServiceProvider } from "./ServiceProvider";

export const DEFAULT_SECTION = "main.md";
export const DEFAULT_CURSOR = "0";

export enum StepMode {
  SINGLE = "single",
  UNTIL_CLIENT = "until_client",
  UNTIL_BLOCKING = "until_blocking",
}

export type Cartridge = Record<string, Buffer | string>;

export interface Playthru {
  id: string;
  engine: string; // Name of preferred playback engine (e.g. Ink)
  time: number; // Real-world Unix time of current game step
  turn: number; // Current turn i.e. game step
  seed: string; // Seed value for PRNG
  cycle: number; // Cycle value for PRNG (to resume at previous point)
  state: {
    input: string;
    section: string;
    cursor: string;
    __inputKey: string;
    __callStack: string[];
    [key: string]: TScalar | TScalar[];
  };
  genie: Cartridge; // Like Game Genie we can monkeypatch the cartridge
}

export interface Story {
  id: string;
  cartridge: Cartridge;
}

export type OP =
  | { type: "sleep"; duration: number }
  | { type: "get-input"; timeLimit: number | null; charLimit: number | null }
  | { type: "play-sound"; audio: string }
  | { type: "play-line"; audio: string; speaker: string; line: string };

export async function advance(
  provider: ServiceProvider,
  story: Story,
  playthru: Playthru,
  mode: StepMode = StepMode.SINGLE
) {
  const out: OP[] = [];

  const rng = new PRNG(playthru.seed, playthru.cycle % 10_000);
  playthru.time = Date.now();
  playthru.turn++;

  const sections = await compile(story.cartridge);
  const { state } = playthru;
  state[state.__inputKey] = state.input;

  while (true) {
    let section = sections.find((s) => s.path === state.section);
    if (!section) {
      break;
    }
    let node: Node | null = section
      ? findNode(section.root, (n) => n.id === state.cursor)
      : null;
    if (!node) {
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
      node,
      section,
      sections,
      state,
      rng,
      atts: renderedAttributes,
      text: renderedText,
    };

    // Check for stopBefore attribute - advance cursor but don't execute
    if (renderedAttributes.stopBefore) {
      const nextPos = nextNode(node, section, false);
      if (nextPos) {
        state.cursor = nextPos.node.id;
        state.section = nextPos.section.path;
      } else {
        state.cursor = DEFAULT_CURSOR;
        state.section = DEFAULT_SECTION;
      }
      break;
    }

    const handler = ACTION_HANDLERS.find((h) => h.match(node));
    const result = await handler!.execute(context, provider);

    out.push(...result.ops);

    // Update cursor position
    if (result.next) {
      state.cursor = result.next.node.id;
      state.section = result.next.section.path;
    } else {
      // No next node - check if we should return from a block
      if (state.__callStack.length > 0) {
        const frame = state.__callStack.pop()!;
        const [returnSection, returnCursor] = frame.split("/");
        state.cursor = returnCursor;
        state.section = returnSection;
      } else {
        state.cursor = DEFAULT_CURSOR;
        state.section = DEFAULT_SECTION;
      }
    }

    // Check for stopAfter attribute or stop tag
    if (renderedAttributes.stopAfter || handler?.type === ActionType.STOP) {
      break;
    }

    const shouldContinue = !handler || handler.type === ActionType.SYNC;
    if (!shouldContinue) break;
    if (mode === StepMode.SINGLE) break;
    if (
      mode === StepMode.UNTIL_CLIENT &&
      handler?.type === ActionType.CLIENT_DEPENDENT
    )
      break;
    if (mode === StepMode.UNTIL_BLOCKING && handler?.type !== ActionType.SYNC)
      break;
  }

  playthru.cycle = rng.cycle;

  return out;
}

export async function compile(cartridge: Cartridge) {
  const sources: Section[] = [];
  for (let path in cartridge) {
    const content = cartridge[path];
    if (path.endsWith(".json")) {
      sources.push(JSON.parse(content.toString("utf-8")));
    } else if (path.endsWith(".md")) {
      const { root, meta } = parseMarkdownToSection(content.toString("utf-8"));
      sources.push({ root, meta, path });
    }
  }
  return sources;
}

export interface ActionContext {
  node: Node;
  section: Section;
  sections: Section[];
  state: Playthru["state"];
  rng: PRNG;
  atts: Record<string, string>;
  text: string;
}

export interface ActionResult {
  ops: OP[];
  next: { node: Node; section: Section } | null;
}

export enum ActionType {
  SYNC = "sync",
  ASYNC_BLOCKING = "async_blocking",
  CLIENT_DEPENDENT = "client_dependent",
  STOP = "stop",
}

interface ActionHandler {
  type: ActionType;
  match: (node: Node) => boolean;
  execute: (
    context: ActionContext,
    services: ServiceProvider
  ) => Promise<ActionResult>;
}

export const ACTION_HANDLERS: ActionHandler[] = [
  {
    type: ActionType.CLIENT_DEPENDENT,
    match: (node: Node) => node.tag === "input",
    execute: async (ctx) => ({
      ops: [
        {
          type: "get-input",
          timeLimit: parseNumberOrNull(ctx.atts.timeLimit ?? ctx.atts.for),
          charLimit: parseNumberOrNull(ctx.atts.charLimit),
        },
      ],
      next: nextNode(ctx.node, ctx.section, false),
    }),
  },
  {
    type: ActionType.ASYNC_BLOCKING,
    match: (node: Node) => node.tag === "llm",
    execute: async (ctx, provider) => {
      let schema = ctx.atts.to ?? ctx.atts.schema;
      if (isBlank(schema)) {
        schema = "_"; // Assigns to the _ variable
      }
      const prompt = ctx.text ?? ctx.atts.prompt;
      if (!isBlank(prompt)) {
        const result = await provider.generateCompletionJson(prompt, schema);
        Object.assign(ctx.state, result);
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
      };
    },
  },
  {
    type: ActionType.SYNC,
    match: (node: Node) => node.tag === "sound" && !!node.atts.url,
    execute: async (ctx) => ({
      ops: [
        {
          type: "play-sound",
          audio: ctx.atts.url,
        },
      ],
      next: nextNode(ctx.node, ctx.section, false),
    }),
  },
  {
    type: ActionType.ASYNC_BLOCKING,
    match: (node: Node) => node.tag === "sound" && !!node.atts.gen,
    execute: async (ctx, provider) => {
      const prompt = ctx.text ?? ctx.atts.prompt ?? "";
      if (!isBlank(prompt)) {
        const { url } = await provider.generateSoundEffect(prompt);
        return {
          ops: [{ type: "play-sound", audio: url }],
          next: nextNode(ctx.node, ctx.section, false),
        };
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
      };
    },
  },
  {
    type: ActionType.SYNC,
    match: (node: Node) => node.tag === "wait",
    execute: async (ctx) => ({
      ops: [
        {
          type: "sleep",
          duration: parseNumberOrNull(ctx.atts.duration ?? ctx.atts.for) ?? 1,
        },
      ],
      next: nextNode(ctx.node, ctx.section, false),
    }),
  },
  {
    type: ActionType.SYNC,
    match: (node: Node) => node.tag === "go",
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
      };
    },
  },
  {
    type: ActionType.SYNC,
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
              };
            } else {
              return {
                ops: [],
                next: nextNode(child, ctx.section, false),
              };
            }
          }
        }
      }
      // No matching when - skip entire case block
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
      };
    },
  },
  {
    type: ActionType.SYNC,
    match: (node: Node) => node.tag === "when",
    execute: async (ctx) => {
      // When encountered directly (not via case), check condition
      const condAttr = ctx.atts.cond;
      if (!condAttr || evalExpr(condAttr, ctx.state, {}, ctx.rng)) {
        // Process children normally
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, true),
        };
      } else {
        // Skip to next sibling
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, false),
        };
      }
    },
  },
  {
    type: ActionType.SYNC,
    match: (node: Node) => node.tag === "if",
    execute: async (ctx) => {
      let next;
      if (
        ctx.node.kids.length > 0 &&
        evalExpr(ctx.atts.cond, ctx.state, {}, ctx.rng)
      ) {
        next = { node: ctx.node.kids[0], section: ctx.section };
      } else {
        next = nextNode(ctx.node, ctx.section, false);
      }
      return {
        ops: [],
        next,
      };
    },
  },
  {
    type: ActionType.SYNC,
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
      };
    },
  },
  {
    type: ActionType.ASYNC_BLOCKING,
    match: (node: Node) => node.tag === "text" || node.tag === "p",
    execute: async (ctx, provider) => {
      const ops: OP[] = [];
      if (!isBlank(ctx.text)) {
        const line = parseTaggedSpeakerLine(ctx.text);
        const { url } = await provider.generateSpeech(line);
        ops.push({
          type: "play-line",
          audio: url,
          speaker: line.speaker,
          line: line.line,
        });
      }
      return {
        ops,
        next: nextNode(ctx.node, ctx.section, false),
      };
    },
  },
  {
    type: ActionType.SYNC,
    match: (node: Node) => node.tag === "block",
    execute: async (ctx) => ({
      ops: [],
      next: skipBlock(ctx.node, ctx.section),
    }),
  },
  {
    type: ActionType.SYNC,
    match: (node: Node) => node.tag === "yield",
    execute: async (ctx) => {
      const targetBlockId = ctx.atts.to;
      const returnTo = ctx.atts.returnTo;
      if (!targetBlockId) {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, false),
        };
      }
      // Find the target block
      const blockResult = searchNode(ctx.sections, ctx.section, targetBlockId);
      if (!blockResult || blockResult.node.tag !== "block") {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, false),
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
        };
      } else {
        return {
          ops: [],
          next: nextNode(blockResult.node, blockResult.section, false),
        };
      }
    },
  },
  {
    type: ActionType.STOP,
    match: (node: Node) => node.tag === "stop",
    execute: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.section, false),
    }),
  },
  {
    type: ActionType.SYNC,
    match: () => true,
    execute: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.section, false),
    }),
  },
];
