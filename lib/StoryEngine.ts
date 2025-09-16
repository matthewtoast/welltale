import chalk from "chalk";
import dedent from "dedent";

import { parseNumberOrNull } from "lib/MathHelpers";
import { PRNG } from "lib/RandHelpers";
import {
  cleanSplit,
  cleanSplitRegex,
  DOLLAR,
  enhanceText,
  isBlank,
  LIQUID,
  snorm,
} from "lib/TextHelpers";
import { get, isEmpty, omit, set } from "lodash";
import { NonEmpty, TSerial } from "typings";
import { makeCheckpoint, recordEvent } from "./CheckpointUtils";
import {
  castToBoolean,
  castToString,
  castToTypeEnhanced,
  isTruthy,
} from "./EvalCasting";
import { evalExpr } from "./EvalUtils";
import { fetch, isValidUrl, toHttpMethod } from "./HTTPHelpers";
import {
  FieldSpec,
  parseFieldGroups,
  parseFieldGroupsNested,
} from "./InputHelpers";
import { safeJsonParse, safeYamlParse } from "./JSONHelpers";
import { AIChatMessage } from "./OpenRouterUtils";
import {
  cloneNode,
  DESCENDABLE_TAGS,
  dumpTree,
  findNodes,
  marshallText,
  searchForNode,
  TEXT_CONTENT_TAGS,
  walkTree,
} from "./StoryNodeHelpers";
import { StoryServiceProvider } from "./StoryServiceProvider";
import {
  DEFAULT_LLM_SLUGS,
  LLM_SLUGS,
  StoryEvent,
  StoryNode,
  StoryOptions,
  StorySession,
  StorySource,
  VoiceSpec,
} from "./StoryTypes";
import { renderTemplate } from "./Template";

export const PLAYER_ID = "USER";
export const HOST_ID = "HOST";

export function createDefaultSession(
  id: string,
  state: Record<string, TSerial> = {},
  meta: Record<string, TSerial> = {}
): StorySession {
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
    flowTarget: null,
    checkpoints: [],
  };
}

export type PlayMediaOptions = {
  media: string; // URL
  volume: number | null;
  fadeDurationMs: number | null; // Milliseconds
  fadeAtMs: number | null; // Milliseconds
  background: boolean | null;
};

export type OP =
  | { type: "sleep"; duration: number }
  | { type: "get-input"; timeLimit: number | null }
  | ({ type: "play-media" } & PlayMediaOptions)
  | ({
      type: "play-event";
      event: StoryEvent;
    } & PlayMediaOptions)
  | { type: "story-end" };

export interface BaseActionContext {
  rng: PRNG;
  provider: StoryServiceProvider;
  scope: { [key: string]: TSerial };
  options: StoryOptions;
}

export interface ActionContext extends BaseActionContext {
  origin: StoryNode;
  root: StoryNode;
  voices: VoiceSpec[];
  node: StoryNode;
  session: StorySession;
  events: StoryEvent[];
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

export function processModuleIncludes(root: StoryNode): void {
  const modules = findNodes(root, (node) => node.type === "module").filter(
    (mod) => !isBlank(mod.atts.id)
  );
  if (modules.length > 0) {
    walkTree(root, (node, parent, idx) => {
      if (parent && node.type === "include" && !isBlank(node.atts.id)) {
        const found = modules.find((mod) => mod.atts.id === node.atts.id);
        parent.kids.splice(idx, 1, ...(found?.kids.map(cloneNode) ?? []));
      }
    });
  }
}

export async function advanceStory(
  provider: StoryServiceProvider,
  source: StorySource,
  session: StorySession,
  options: StoryOptions
): Promise<{
  ops: OP[];
  session: StorySession;
  seam: SeamType;
  info: Record<string, string>;
}> {
  const out: OP[] = [];
  const evs: StoryEvent[] = [];

  const rng = new PRNG(options.seed, session.cycle % 10_000);
  session.time = Date.now();
  session.turn += 1;

  const root = source.root;
  processModuleIncludes(root);

  const voices = source.voices;

  if (calls++ < 1) {
    console.info(chalk.gray(dumpTree(root)));
  }

  // The origin (if present) is the node the author wants to treat as the de-facto beginning of playback
  const origin = findNodes(root, (node) => node.type === "origin")[0] ?? root;

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
    if (evs.length > 0) {
      makeCheckpoint(session, options, evs);
      evs.length = 0;
    }
    session.cycle = rng.cycle;
    return { ops: out, session, seam, info };
  }

  const eventHandlers = findNodes(root, (node) => node.type === "event");

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
      voices,
      node,
      session,
      rng,
      provider,
      // We need to get a new scope on every node since it may have introduced new scope
      scope: createScope(session),
      events: evs,
    };

    if (session.input) {
      const { body, atts } = session.input;
      recordEvent(evs, {
        from: PLAYER_ID,
        body: castToString(body),
        to: cleanSplit(atts.to, ","),
        obs: cleanSplit(atts.obs, ","),
        tags: cleanSplit(atts.tags, ","),
        time: Date.now(),
      });

      // const inputHandlers = eventHandlers.filter(
      //   (e) => e.atts.type === "input"
      // );
      // for (let i = 0; i < inputHandlers.length; i++) {
      //   const atts = await renderAtts(inputHandlers[i].atts, ctx);
      //   // TODO: run inner content if event matches.
      // }
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
      if (session.flowTarget) {
        session.address = session.flowTarget;
        session.flowTarget = null;
        continue;
      }
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
    match: (node: StoryNode) => node.type === "llm:parse",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const schemaAll = parseFieldGroupsNested(publicAtts(atts));
      const schema: Record<string, TSerial> = {};
      for (const k in schemaAll) {
        if (k === "key" || k === "web") continue;
        schema[k] = schemaAll[k];
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = attsToModels(ctx.options, atts.models);
      const result = await ctx.provider.generateJson(
        dedent`
          Extract structured data from the input per the schema.
          <input>${prompt}</input>
        `,
        schema,
        { models, useWebSearch }
      );
      const key = atts.key ?? "parse";
      setState(ctx.scope, key, result as unknown as TSerial);
      return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm:classify",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const cleaned = publicAtts(atts);
      const cats: string[] = [];
      for (const k in cleaned) {
        if (k === "key" || k === "web") continue;
        if (!k.includes(".")) cats.push(k);
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = attsToModels(ctx.options, atts.models);
      const out = await ctx.provider.generateText(
        dedent`
          Classify the input into one of these labels: ${cats.join(", ")}.
          Return only the winning label.
          <input>${prompt}</input>
        `,
        { models, useWebSearch }
      );
      const key = atts.key ?? "classify";
      setState(ctx.scope, key, out);
      return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm:score",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const cleaned = publicAtts(atts);
      const schema: Record<string, TSerial> = {};
      for (const k in cleaned) {
        if (k === "key" || k === "web") continue;
        if (!k.includes(".")) schema[k] = "number";
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = attsToModels(ctx.options, atts.models);
      const result = await ctx.provider.generateJson(
        dedent`
          Score the input for each key between 0.0 and 1.0.
          Return only numeric scores.
          <input>${prompt}</input>
        `,
        schema,
        { models, useWebSearch }
      );
      const key = atts.key ?? "score";
      setState(ctx.scope, key, result as unknown as TSerial);
      return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm:generate",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const schemaAll = parseFieldGroupsNested(publicAtts(atts));
      const schema: Record<string, TSerial> = {};
      for (const k in schemaAll) {
        if (k === "key" || k === "web") continue;
        schema[k] = schemaAll[k];
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = attsToModels(ctx.options, atts.models);
      const result = await ctx.provider.generateJson(
        dedent`
          Generate data per the instruction, conforming to the schema.
          <instruction>${prompt}</instruction>
        `,
        schema,
        { models, useWebSearch }
      );
      const key = atts.key ?? "generate";
      setState(ctx.scope, key, result as unknown as TSerial);
      return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm:dialog",
    exec: async (ctx) => {
      const ops: OP[] = [];
      const next = nextNode(ctx.node, ctx.root, false);
      const atts = await renderAtts(ctx.node.atts, ctx);
      const assistant =
        atts.npc ?? atts.ai ?? atts.assistant ?? atts.from ?? HOST_ID;
      const user = atts.user ?? atts.player ?? PLAYER_ID;
      const message = atts.message ?? atts.input;
      if (isBlank(assistant) || isBlank(user) || isBlank(message)) {
        return { ops, next };
      }
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      // Checkpoints *should* be in sequential order
      const events = ctx.session.checkpoints.flatMap((cp) =>
        cp.events.filter((ev) => {
          return (
            (ev.from === assistant && ev.to.includes(user)) ||
            (ev.from === user && ev.to.includes(assistant))
          );
        })
      );
      const messages: AIChatMessage[] = [
        { role: "system", body: prompt },
        ...events.map((ev) => {
          if (ev.from === assistant) {
            return { role: "assistant" as const, body: ev.body };
          }
          return { role: "user" as const, body: ev.body };
        }),
      ];
      const response = await ctx.provider.generateChat(messages);
      const event: StoryEvent = {
        body: snorm(response.body),
        from: assistant,
        to: [user],
        obs: atts.obs ? cleanSplit(atts.obs, ",") : [],
        tags: atts.tags ? cleanSplit(atts.tags, ",") : [],
        time: Date.now(),
      };
      const { url } = ctx.options.doGenerateSpeech
        ? await ctx.provider.generateSpeech(
            {
              speaker: event.from,
              voice: atts.voice ?? event.from,
              tags: event.tags,
              body: event.body,
            },
            ctx.voices
          )
        : { url: "" };
      ops.push({
        type: "play-event",
        media: url,
        event,
        fadeAtMs: null,
        fadeDurationMs: null,
        background: false,
        volume: parseNumberOrNull(atts.volume),
      });
      return { ops, next };
    },
  },
  {
    match: (node: StoryNode) => node.type === "data",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const url = atts.src ?? atts.href ?? atts.url;
      let raw = "";
      let fmt = (atts.format ?? "json").toLowerCase();
      if (!isBlank(url) && isValidUrl(url)) {
        const { data, statusCode, contentType } = await fetch({
          url,
          method: toHttpMethod(atts.method ?? "GET"),
        });
        if (statusCode >= 200 && statusCode <= 299) {
          raw = data;
        }
        if (contentType.includes("json")) {
          fmt = "json";
        } else if (
          contentType.includes("yaml") ||
          contentType.includes("yml")
        ) {
          fmt = "yaml";
        }
      }

      // Treated as the data in the normal case, or fallback if we have a URL
      if (isBlank(raw)) {
        raw = await renderText(await marshallText(ctx.node, ctx, ""), ctx);
      }

      let val = null as TSerial | null;
      if (fmt === "yaml" || fmt === "yml") {
        const parsed = safeYamlParse(raw);
        val = (parsed ?? null) as unknown as TSerial | null;
      } else if (fmt === "json") {
        const parsed = safeJsonParse(raw);
        val = (parsed ?? null) as unknown as TSerial | null;
      } else {
        val = raw;
      }

      const key = atts.key ?? "data";
      setState(ctx.scope, key, val);
      return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
    },
  },
  {
    match: (node) =>
      DESCENDABLE_TAGS.includes(node.type) && node.type !== "scope",
    exec: async (ctx) => {
      // Auto-checkpoint on entering a section
      if (ctx.node.type === "sec") {
        makeCheckpoint(ctx.session, ctx.options, ctx.events);
        ctx.events.length = 0;
      }
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
      const atts = await renderAtts(ctx.node.atts, ctx);
      let text = "";
      if (isBlank(text)) {
        // Assume text nodes never contain actionable children, only text
        text = await renderText(await marshallText(ctx.node, ctx), ctx);
      }
      // Early exit spurious empty nodes
      if (isBlank(text)) {
        return {
          ops,
          next,
        };
      }
      const event: StoryEvent = {
        body: snorm(text),
        from: atts.from ?? atts.speaker ?? atts.label ?? HOST_ID,
        to: atts.to ? cleanSplit(atts.to, ",") : [PLAYER_ID],
        obs: atts.obs ? cleanSplit(atts.obs, ",") : [],
        tags: atts.tags ? cleanSplit(atts.tags, ",") : [],
        time: Date.now(),
      };
      const { url } = ctx.options.doGenerateSpeech
        ? await ctx.provider.generateSpeech(
            {
              speaker: event.from,
              voice: atts.voice ?? event.from,
              tags: event.tags,
              body: event.body,
            },
            ctx.voices
          )
        : { url: "" };
      ops.push({
        type: "play-event",
        media: url,
        event,
        volume: parseNumberOrNull(atts.volume),
        // Probably not likely to be used unless someone wants trailing off speech?
        fadeAtMs: parseNumberOrNull(atts.fadeAt),
        fadeDurationMs: parseNumberOrNull(atts.fadeDuration),
        background: castToBoolean(atts.background),
      });
      recordEvent(ctx.events, event);
      return {
        ops,
        next,
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "checkpoint",
    exec: async (ctx) => {
      makeCheckpoint(ctx.session, ctx.options, ctx.events);
      ctx.events.length = 0;
      return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "if",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
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
      const atts = await renderAtts(ctx.node.atts, ctx);
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
    match: (node: StoryNode) => node.type === "continue",
    exec: async (ctx) => {
      const w = nearestAncestorOfType(ctx.node, ctx.root, "while");
      if (!w) {
        return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
      }
      const count = countStackContainersBetween(ctx.node, w, ctx.root);
      const toPop = Math.min(count, ctx.session.stack.length);
      for (let i = 0; i < toPop; i++) ctx.session.stack.pop();
      ctx.session.flowTarget = w.addr;
      return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "break",
    exec: async (ctx) => {
      const w = nearestAncestorOfType(ctx.node, ctx.root, "while");
      if (!w) {
        return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
      }
      const after = nextNode(w, ctx.root, false);
      if (!after) {
        return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
      }
      const count = countStackContainersBetween(ctx.node, w, ctx.root);
      const toPop = Math.min(count, ctx.session.stack.length);
      for (let i = 0; i < toPop; i++) ctx.session.stack.pop();
      ctx.session.flowTarget = after.node.addr;
      return { ops: [], next: nextNode(ctx.node, ctx.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "jump",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
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
      const atts = await renderAtts(ctx.node.atts, ctx);
      const key = atts.name ?? atts.var ?? atts.key ?? atts.id;
      let rollup = (await marshallText(ctx.node, ctx)).trim();
      const value = await renderText(
        !isBlank(rollup) ? rollup : atts.value,
        ctx
      );
      setState(ctx.scope, key, castToTypeEnhanced(value, atts.type));
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type.startsWith("var."),
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const key = atts.name ?? atts.var ?? atts.key ?? atts.id;
      const [v, ...ops] = ctx.node.type.split(".");
      const last = ops.pop();
      if (last && key) {
        const script = `${last}(${key})`;
        setState(ctx.scope, key, evalExpr(script, ctx.scope, {}, ctx.rng));
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.root, false),
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "code" || node.type === "script",
    exec: async (ctx) => {
      const text = await renderText(await marshallText(ctx.node, ctx), ctx);
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
      const atts = await renderAtts(ctx.node.atts, ctx);
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
      const atts = await renderAtts(ctx.node.atts, ctx);
      const targetBlockId = atts.target ?? atts.to;
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
      node.type === "speech",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      let url = atts.href ?? atts.url ?? atts.src;
      const next = nextNode(ctx.node, ctx.root, false);
      const ops: OP[] = [];
      if (!url) {
        const rollup = await renderText(await marshallText(ctx.node, ctx), ctx);
        const prompt = (
          !isBlank(rollup)
            ? rollup
            : (atts.make ?? atts.prompt ?? atts.description)
        ).trim();
        if (!isBlank(prompt)) {
          if (ctx.options.doGenerateAudio) {
            switch (ctx.node.type) {
              case "sound":
              case "audio":
                const audio = await ctx.provider.generateSound(
                  prompt,
                  parseNumberOrNull(atts.duration) ?? 5_000
                );
                url = audio.url;
                break;
              case "music":
                const music = await ctx.provider.generateMusic(
                  prompt,
                  parseNumberOrNull(atts.duration) ?? 10_000
                );
                url = music.url;
                break;
              case "speech":
                const voice = await ctx.provider.generateSpeech(
                  {
                    voice: atts.voice,
                    speaker: atts.from ?? atts.speaker ?? atts.voice,
                    body: prompt,
                    tags: cleanSplit(atts.tags, ","),
                  },
                  ctx.voices
                );
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
          fadeAtMs: parseNumberOrNull(atts.fadeAt),
          fadeDurationMs: parseNumberOrNull(atts.fadeDuration),
          volume: parseNumberOrNull(atts.volume),
          background: castToBoolean(atts.background),
        });
      }
      return {
        ops,
        next,
      };
    },
  },
  {
    match: (node: StoryNode) =>
      node.type === "input" || node.type === "textarea",
    exec: async (ctx) => {
      const nextAfter = nextNode(ctx.node, ctx.root, false);
      const atts = await renderAtts(ctx.node.atts, ctx);
      const inp = ctx.session.input;

      if (!inp) {
        // Auto-checkpoint before yielding for input
        makeCheckpoint(ctx.session, ctx.options, ctx.events);
        ctx.events.length = 0;
      }

      if (ctx.session.input && ctx.session.input.body !== null) {
        const raw = ctx.session.input.body;
        // Make original input available in state
        ctx.scope["input"] = raw;
        if (!isBlank(atts.key)) {
          ctx.scope[atts.key] = raw;
        }

        const groups: Record<string, FieldSpec> = parseFieldGroups(atts);
        const keys = Object.keys(groups);

        let extracted: Record<string, TSerial> = {};
        const parsed = safeJsonParse(raw);
        if (parsed && typeof parsed === "object") {
          extracted = parsed as Record<string, TSerial>;
        } else {
          for (const key of keys) {
            const spec = groups[key];
            extracted[key] = await processInputValue(
              castToString(raw),
              spec,
              ctx
            );
          }
        }

        for (const key in extracted) {
          ctx.scope[key] = extracted[key];
        }

        ctx.session.input = null;
        // We received input and processed, so proceed to next node now
        return { ops: [], next: nextAfter ?? null };
      }

      return {
        ops: [
          {
            type: "get-input",
            timeLimit: parseNumberOrNull(atts.timeLimit ?? atts.for),
          },
        ],
        // We remain at this node while we get input
        next: { node: ctx.node },
      };
    },
  },
  {
    match: (node) => node.type === "log",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const rollup = await renderText(await marshallText(ctx.node, ctx), ctx);
      const message = !isBlank(rollup) ? rollup : atts.message;
      if (message) {
        console.info(atts.message);
      }
      if (!message || atts.dump) {
        console.dir(
          {
            atts,
            session: omit(ctx.session, ["checkpoints"]),
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

export function attsToModels(
  options: StoryOptions,
  attms: string | undefined
): NonEmpty<(typeof LLM_SLUGS)[number]> {
  const models: (typeof LLM_SLUGS)[number][] = [...options.models];
  const want = cleanSplit(attms, ",")
    .filter((m) => (LLM_SLUGS as readonly string[]).includes(m))
    .reverse();
  for (const w of want) models.unshift(w as (typeof LLM_SLUGS)[number]);
  const out = (models.length > 0 ? models : [...DEFAULT_LLM_SLUGS]) as NonEmpty<
    (typeof LLM_SLUGS)[number]
  >;
  return out;
}

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

function nearestAncestorOfType(
  node: StoryNode,
  root: StoryNode,
  type: string
): StoryNode | null {
  let p = parentNodeOf(node, root);
  while (p) {
    if (p.type === type) return p;
    p = parentNodeOf(p, root);
  }
  return null;
}

function isStackContainerType(t: string): boolean {
  return (
    t === "block" ||
    t === "scope" ||
    t === "intro" ||
    t === "resume" ||
    t === "error"
  );
}

function countStackContainersBetween(
  node: StoryNode,
  ancestor: StoryNode,
  root: StoryNode
): number {
  let count = 0;
  let p = parentNodeOf(node, root);
  while (p && p.addr !== ancestor.addr) {
    if (isStackContainerType(p.type)) count += 1;
    p = parentNodeOf(p, root);
  }
  return count;
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
      node.type === "resume" ||
      node.type === "error"
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

async function processInputValue(
  raw: string,
  atts: Record<string, string>,
  ctx: ActionContext
): Promise<TSerial> {
  let value: TSerial = raw;
  const type = atts.type ?? "string";
  const fallback = atts.default ?? "";

  // AI Enhancement
  if (!isBlank(atts.make)) {
    const enhanced = await ctx.provider.generateJson(
      dedent`
        Extract the most appropriate value of type "${type}" from the input, per the instruction, conforming to the pattern.
        <input>${raw}</input>
        <instruction>${atts.make}</instruction>
        <pattern>${atts.pattern ?? ".*"}</pattern>
      `,
      { value: type },
      {
        models: DEFAULT_LLM_SLUGS,
        useWebSearch: false,
      }
    );
    value = enhanced.value;
  }

  // Default Fallback
  if (isBlank(value)) {
    value = fallback;
  }

  // Parse Expression (using existing evalExpr)
  if (atts.parse) {
    value = evalExpr(
      castToString(atts.parse),
      { ...ctx.scope, input: value },
      {},
      ctx.rng
    );
    if (value === undefined || value === null) {
      value = fallback;
    }
  }

  // Pattern Validation
  if (atts.pattern) {
    const pattern = castToString(atts.pattern);
    if (!new RegExp(pattern).test(castToString(value))) {
      value = fallback; // If not valid, make blank to be filled in by defaults later
    }
  }

  // Type Casting
  if (atts.type) {
    value = castToTypeEnhanced(value, atts.type);
  }

  return value;
}

export function createScope(session: StorySession): { [key: string]: TSerial } {
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
      return globalState[prop] ?? { session }[prop] ?? null;
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
  ctx: BaseActionContext
): Promise<string> {
  if (isBlank(text) || text.length < 3) {
    return text;
  }
  let result = renderTemplate(text, ctx.scope ?? {});
  if (ctx.rng) {
    result = await enhanceText(
      result,
      async (chunk: string) => {
        return castToString(evalExpr(chunk, ctx.scope ?? {}, {}, ctx.rng!));
      },
      DOLLAR
    );
  }
  if (ctx.provider) {
    result = await enhanceText(
      result,
      async (chunk: string) => {
        return await ctx.provider!.generateText(chunk, {
          models: ctx.options?.models ?? DEFAULT_LLM_SLUGS,
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
  ctx: BaseActionContext
) {
  const out: Record<string, string> = {};
  for (const key in atts) {
    if (typeof atts[key] === "string") {
      out[key] = await renderText(atts[key], ctx);
    }
  }
  return out;
}
