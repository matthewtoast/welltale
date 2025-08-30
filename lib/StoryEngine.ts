import chalk from "chalk";
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
import {
  compile,
  dumpTree,
  FRAG_TAG,
  Section,
  StoryNode,
  TEXT_TAG,
} from "lib/StoryCompiler";
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

export const DEFAULT_SECTION = "main.xml";
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
    __address: string;
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
      __address: DEFAULT_CURSOR,
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
  maxItersPerAdvance: number;
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

  let iters = 0;

  while (true) {
    let section = sections.find((s) => s.path === state.__section);
    if (!section) {
      console.warn(`Section ${state.__section} not found`);
      break;
    }

    let node: StoryNode | null = section
      ? findNodeFromRoot(
          section.root,
          (node, parent, address) =>
            node.addr === state.__address || address === state.__address
        )
      : null;

    if (!node) {
      console.warn(`Node ${state.__address} not found in ${section.path}`);
      break;
    }

    const rendered = nodeToRenderedNode(node, state, rng);

    const ctx: ActionContext = {
      options,
      orig: node,
      node: rendered,
      section,
      sections,
      state,
      playthru,
      rng,
    };

    const handler = ACTION_HANDLERS.find((h) => h.match(node))!;
    const result = await handler.exec(ctx, provider);
    out.push(...result.ops);

    log(
      `<${node.type} ${node.addr}${node.type.startsWith("h") ? ` "${node.text}"` : ""}${isEmpty(node.atts) ? "" : " " + JSON.stringify(node.atts)} ${result.flow}>`,
      `~> ${result.next?.node.addr}`,
      result.ops
    );

    // Update cursor position
    if (result.next) {
      state.__address = result.next.node.addr;
      state.__section = result.next.section.path;
    } else {
      // No next node - check if we should return from a block
      if (state.__callStack.length > 0) {
        const frame = state.__callStack.pop()!;
        const [returnSection, returnAddress] = frame.split("/");
        state.__address = returnAddress;
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

    if (iters++ >= options.maxItersPerAdvance) {
      console.warn(`Reached max iterations ${iters}`);
      break;
    }
  }

  playthru.cycle = rng.cycle;

  log("DONE", omit(playthru, "history"), out);

  return out;
}

export function nodeToRenderedNode(
  node: StoryNode,
  state: Record<string, TScalar | TScalar[]>,
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

export interface ActionContext {
  options: PlayOptions;
  orig: StoryNode;
  node: StoryNode;
  section: Section;
  sections: Section[];
  state: Playthru["state"];
  playthru: Playthru;
  rng: PRNG;
}

export enum FlowType {
  CONTINUE = "continue",
  BLOCKING = "blocking",
  WAITING = "waiting",
}

export interface ActionResult {
  ops: OP[];
  next: { node: StoryNode; section: Section } | null;
  flow: FlowType;
}

interface ActionHandler {
  match: (node: StoryNode) => boolean;
  exec: (
    context: ActionContext,
    services: ServiceProvider
  ) => Promise<ActionResult>;
}

export const ACTION_HANDLERS: ActionHandler[] = [
  {
    match: (node) => node.type === "root" || node.type === FRAG_TAG,
    exec: async (ctx) => {
      const next = nextNode(ctx.node, ctx.section, true);
      return {
        ops: [],
        next: next,
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node) => node.type === "ul" || node.type === "ol",
    exec: async (ctx) => ({
      ops: [],
      next: nextNode(ctx.node, ctx.section, true),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: StoryNode) => node.type === "section" || node.type === "sec",
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, true),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type.startsWith("h"), // <h*>, <header>, <head>, <hr>
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
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
      const next = nextNode(ctx.node, ctx.section, true);
      const ops: OP[] = [];
      let text = ctx.node.text;
      // If we have a ref tag, assume it refers to a <def>
      if (ctx.node.atts.ref) {
        const stored = castToString(ctx.state[ctx.node.atts.ref]);
        if (stored) {
          text = renderHandlebars(stored, ctx.state, ctx.rng);
        }
      }
      // Early exit spurious empty nodes
      if (isBlank(text)) {
        return {
          ops,
          next,
          flow: FlowType.CONTINUE,
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
        flow: FlowType.CONTINUE,
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
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "input",
    exec: async (ctx) => {
      const toKey = ctx.node.atts.to ?? "input";
      ctx.state.__inputKey = toKey;
      const castType =
        ctx.node.atts.as ?? ctx.node.atts.cast ?? ctx.node.atts.type;
      if (castType) {
        ctx.state.__inputType = castType;
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
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.WAITING,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "if",
    exec: async (ctx) => {
      let next;
      const conditionTrue = evalExpr(
        ctx.node.atts.cond,
        ctx.state,
        {},
        ctx.rng
      );
      if (conditionTrue && ctx.node.kids.length > 0) {
        // Find first non-else child
        const firstNonElse = ctx.node.kids.find((k) => k.type !== "else");
        if (firstNonElse) {
          next = { node: firstNonElse, section: ctx.section };
        } else {
          next = nextNode(ctx.node, ctx.section, false);
        }
      } else {
        // Look for else block
        const elseChild = ctx.node.kids.find((k) => k.type === "else");
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
    match: (node: StoryNode) => node.type === "jump",
    exec: async (ctx) => {
      let next;
      if (
        !ctx.node.atts.if ||
        evalExpr(ctx.node.atts.if, ctx.state, {}, ctx.rng)
      ) {
        next = searchForNode(ctx.sections, ctx.section, ctx.node.atts.to);
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
    match: (node: StoryNode) => node.type === "var",
    exec: async (ctx) => {
      const value = !isBlank(ctx.node.text)
        ? ctx.node.text
        : ctx.node.atts.value;
      const key =
        ctx.node.atts.name ??
        ctx.node.atts.var ??
        ctx.node.atts.to ??
        ctx.node.atts.key;
      ctx.state[key] = value; // By default, use the string
      try {
        // Try to eval incase it was an expression, but it's okay if it's just text
        ctx.state[key] = evalExpr(value, ctx.state, {}, ctx.rng);
      } catch (e) {}
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "def",
    exec: async (ctx) => {
      // Get the *unrendered* content to be rendered dynamically later!
      const value = !isBlank(ctx.orig.text)
        ? ctx.orig.text
        : ctx.orig.atts.value;
      const key =
        ctx.node.atts.name ??
        ctx.node.atts.var ??
        ctx.node.atts.to ??
        ctx.node.atts.key ??
        ctx.node.atts.id; // Use the id as the storage by default, to refer to with ref="..."
      // Again, we're storing *unrendered* here
      ctx.state[key] = value;
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "pre", // <pre> wraps <code>, but sometimes not
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, true),
        flow: FlowType.CONTINUE,
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
            evalExpr(line, ctx.state, {}, ctx.rng);
          });
        });
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.section, false),
        flow: FlowType.CONTINUE,
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
      next: nextNode(ctx.node, ctx.section, false),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: StoryNode) => node.type === "block",
    exec: async (ctx) => ({
      ops: [],
      next: skipBlock(ctx.node, ctx.section),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: StoryNode) => node.type === "yield",
    exec: async (ctx) => {
      const targetBlockId = ctx.node.atts.to;
      const returnTo = ctx.node.atts.returnTo ?? ctx.node.atts.return;
      if (!targetBlockId) {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, false),
          flow: FlowType.CONTINUE,
        };
      }
      // Find the target block
      const blockResult = searchForNode(
        ctx.sections,
        ctx.section,
        targetBlockId
      );
      if (!blockResult || blockResult.node.type !== "block") {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.section, false),
          flow: FlowType.CONTINUE,
        };
      }
      // Determine return address
      let returnSection: string;
      let returnAddress: string;
      if (returnTo) {
        const returnResult = searchForNode(ctx.sections, ctx.section, returnTo);
        if (returnResult) {
          returnSection = returnResult.section.path;
          returnAddress = returnResult.node.addr;
        } else {
          const next = nextNode(ctx.node, ctx.section, false);
          returnSection = next?.section.path ?? DEFAULT_SECTION;
          returnAddress = next?.node.addr ?? DEFAULT_CURSOR;
        }
      } else {
        const next = nextNode(ctx.node, ctx.section, false);
        returnSection = next?.section.path ?? DEFAULT_SECTION;
        returnAddress = next?.node.addr ?? DEFAULT_CURSOR;
      }
      ctx.state.__callStack.push(`${returnSection}/${returnAddress}`);
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
    match: (node: StoryNode) => node.type === "llm",
    exec: async (ctx, provider) => {
      let schema = ctx.node.atts.to ?? ctx.node.atts.schema;
      if (isBlank(schema)) {
        schema = "_"; // Assigns to the _ variable
      }
      const prompt = ctx.node.text ?? ctx.node.atts.prompt;
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
    match: (node: StoryNode) => node.type === "sound" && !!node.atts.url,
    exec: async (ctx) => ({
      ops: [
        {
          type: "play-sound",
          audio: ctx.node.atts.url,
        },
      ],
      next: nextNode(ctx.node, ctx.section, false),
      flow: FlowType.CONTINUE,
    }),
  },
  {
    match: (node: StoryNode) => node.type === "sound" && !!node.atts.gen,
    exec: async (ctx, provider) => {
      const prompt = ctx.node.text ?? ctx.node.atts.prompt ?? "";
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

export function skipBlock(
  blockNode: StoryNode,
  section: Section
): { node: StoryNode; section: Section } | null {
  // Skip past the entire block by going to its next sibling
  return nextNode(blockNode, section, false);
}

export function nextNode(
  curr: StoryNode,
  section: Section,
  useKids: boolean
): { node: StoryNode; section: Section } | null {
  // Given a node and the section it is within, find the "next" node.
  // If useKids is true and current node has children, it's the first child
  if (useKids && curr.kids.length > 0) {
    return { node: curr.kids[0], section };
  }

  // Find parent and check for next sibling
  const parent = parentNodeOf(curr, section);
  if (!parent) return null;

  const siblingIndex = parent.kids.findIndex((k) => k.addr === curr.addr);
  if (siblingIndex >= 0 && siblingIndex < parent.kids.length - 1) {
    return { node: parent.kids[siblingIndex + 1], section };
  }

  // No more siblings, recurse up the tree
  return nextNode(parent, section, false);
}

export function parentNodeOf(
  node: StoryNode,
  section: Section
): StoryNode | null {
  if (node.addr === section.root.addr) return null;

  return findNodeFromRoot(section.root, (n) => {
    return n.kids.some((k) => k.addr === node.addr);
  });
}

export function searchInSection(
  section: Section,
  term: string
): StoryNode | null {
  return findNodeFromRoot(section.root, (node, parent, address) => {
    if (node.atts.id === term) return true;
    if (node.addr === term) return true;
    // TODO: Other ways to search? CSS selector? XPath?
    return false;
  });
}

export function searchForNode(
  sections: Section[],
  current: Section,
  flex: string | null | undefined
): { node: StoryNode; section: Section } | null {
  if (!flex || isBlank(flex)) {
    return null;
  }
  // Search starting with current section, then expand
  const searchables = [
    current,
    ...sections.filter((s) => s.path !== current.path),
  ];
  for (const section of searchables) {
    const node = searchInSection(section, flex);
    if (node) {
      return { node, section };
    }
  }
  return null;
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
