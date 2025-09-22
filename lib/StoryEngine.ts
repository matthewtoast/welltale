import dedent from "dedent";
import { isEmpty, omit, set } from "lodash";
import { NonEmpty, TSerial } from "../typings";
import { makeCheckpoint, recordEvent } from "./CheckpointUtils";
import { ELEVENLABS_PRESET_VOICES } from "./ElevenLabsVoices";
import {
  castToBoolean,
  castToString,
  castToTypeEnhanced,
  isTruthy,
} from "./EvalCasting";
import { ensureArray, evalExpr } from "./EvalUtils";
import { isValidUrl, toHttpMethod } from "./HTTPHelpers";
import { parseFieldGroupsNested } from "./InputHelpers";
import { safeJsonParse, safeYamlParse } from "./JSONHelpers";
import { parseNumberOrNull } from "./MathHelpers";
import { AIChatMessage } from "./OpenRouterUtils";
import { PRNG } from "./RandHelpers";
import { extractInput } from "./StoryInput";
import {
  DESCENDABLE_TAGS,
  dumpTree,
  extractReadableBlocks,
  findNodes,
  marshallText,
  searchForNode,
  TEXT_CONTENT_TAGS,
} from "./StoryNodeHelpers";
import { StoryServiceProvider } from "./StoryServiceProvider";
import {
  DEFAULT_LLM_SLUGS,
  LLM_SLUGS,
  StoryAdvanceResult,
  StoryEvent,
  StoryNode,
  StoryOptions,
  StorySession,
  StorySource,
  VoiceSpec,
} from "./StoryTypes";
import { renderTemplate } from "./Template";
import {
  cleanSplit,
  cleanSplitRegex,
  DOLLAR,
  enhanceText,
  isBlank,
  LIQUID,
  snorm,
} from "./TextHelpers";

export const PLAYER_ID = "USER";
export const HOST_ID = "HOST";
const OUTRO_RETURN_ADDR = "__outro:return__";

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
    outroDone: false,
    inputTries: {},
    inputLast: null,
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
  | { type: "story-error"; reason: string }
  | { type: "story-end" };

export interface BaseActionContext {
  rng: PRNG;
  provider: StoryServiceProvider;
  scope: { [key: string]: TSerial };
  options: StoryOptions;
}

export interface ActionContext extends BaseActionContext {
  origin: StoryNode;
  node: StoryNode;
  session: StorySession;
  source: StorySource;
  events: StoryEvent[];
}

export enum SeamType {
  INPUT = "input", // Client is expected to send user input in next call
  MEDIA = "media", // Server produced media to render
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
  provider: StoryServiceProvider,
  source: StorySource,
  session: StorySession,
  options: StoryOptions
): Promise<StoryAdvanceResult> {
  const out: OP[] = [];
  const evs: StoryEvent[] = [];

  const rng = new PRNG(options.seed, session.cycle % 10_000);
  session.time = Date.now();
  session.turn += 1;

  if (calls++ < 1 && options.verbose) {
    console.info(dumpTree(source.root));
  }

  // The origin (if present) is the node the author wants to treat as the de-facto beginning of playback
  const origin =
    findNodes(source.root, (node) => node.type === "origin")[0] ?? source.root;
  const outro =
    findNodes(source.root, (node) => node.type === "outro")[0] ?? null;

  if (session.turn === 1 && !session.resume) {
    await execNodes(
      source.root.kids.filter((node) =>
        ["var", "code", "script", "data"].includes(node.type)
      ),
      provider,
      source,
      session,
      options,
      rng,
      origin
    );
  }

  // Check for resume first (takes precedence over intro)
  if (session.resume) {
    session.resume = false;
    const resume = findNodes(source.root, (node) => node.type === "resume")[0];
    if (resume) {
      session.stack.push({
        returnAddress: session.address || origin.addr,
        scope: null,
        blockType: "resume",
      });
      session.address = resume.addr;
    } else if (!session.address) {
      session.address = origin.addr;
    }
  } else if (session.turn === 1) {
    // Check for intro on first turn (only if not resuming)
    const intro = findNodes(source.root, (node) => node.type === "intro")[0];
    if (intro) {
      session.stack.push({
        returnAddress: origin.addr,
        scope: null,
        blockType: "intro",
      });
      session.address = intro.addr;
    } else {
      session.address = origin.addr;
    }
  } else if (!session.address) {
    session.address = origin.addr;
  }

  function done(
    seam: SeamType,
    addr: string | null,
    info: Record<string, string>
  ) {
    if (evs.length > 0) {
      makeCheckpoint(session, options, evs);
      evs.length = 0;
    }
    session.cycle = rng.cycle;
    return { ops: out, session, seam, addr, info };
  }

  const handlers = findNodes(source.root, (node) => node.type === "event");

  const visits: Record<string, number> = {};
  let iterations = 0;

  while (true) {
    if (session.address === OUTRO_RETURN_ADDR) {
      session.address = null;
      out.push({ type: "story-end" });
      return done(SeamType.FINISH, null, {});
    }

    let node: StoryNode | null =
      findNodes(source.root, (node) => node.addr === session.address)[0] ??
      null;

    if (!node) {
      const error = `Node ${session.address} not found`;
      console.warn(error);
      return done(SeamType.ERROR, null, { error });
    }

    if (!visits[node.addr]) {
      visits[node.addr] += 1;
    } else {
      return done(SeamType.GRANT, node.addr, {
        reason: `Loop encountered at node ${node.addr}`,
      });
    }

    if (iterations > 0 && iterations % options.ream === 0) {
      iterations += 1;
      return done(SeamType.GRANT, node.addr, {
        reason: `Iteration ${iterations} reached`,
      });
    }

    const ctx: ActionContext = {
      options,
      origin,
      source,
      node,
      session,
      rng,
      provider,
      // We need to get a new scope on every node since it may have introduced new scope
      scope: createScope(session, source.meta),
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
    }

    const handler = ACTION_HANDLERS.find((h) => h.match(node))!;
    const result = await handler.exec(ctx);
    out.push(...result.ops);

    if (out.length > 0) {
      const recent = out[out.length - 1];
      if (recent.type === "story-error") {
        return done(SeamType.ERROR, node.addr, { reason: recent.reason });
      }
    }

    if (options.verbose) {
      console.info(
        `<${node.type} ${node.addr}${isEmpty(node.atts) ? "" : " " + JSON.stringify(node.atts)}> ~> ${result.next?.node.addr} ${JSON.stringify(result.ops)}`
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
        wouldEscapeCurrentBlock(node, result.next.node, source.root)
      ) {
        const topFrame = session.stack[session.stack.length - 1];
        if (topFrame.blockType === "yield") {
          session.address = result.next.node.addr;
        } else {
          const frame = session.stack.pop()!;
          if (frame.blockType === "intro" || frame.blockType === "resume") {
            if (node.type === "jump") {
              session.address = result.next.node.addr;
            } else {
              session.address = frame.returnAddress;
            }
          } else {
            session.address = frame.returnAddress;
          }
        }
      } else {
        session.address = result.next.node.addr;
      }
    } else {
      // No next node - check if we should return from a block
      if (session.stack.length > 0) {
        const { returnAddress, blockType } = session.stack.pop()!;

        // If we just finished a yield block and the return address is the same as the parent's return,
        // we should pop the parent frame too to avoid double execution
        if (blockType === "yield" && session.stack.length > 0) {
          const parentFrame = session.stack[session.stack.length - 1];
          if (parentFrame.returnAddress === returnAddress) {
            // Pop the parent frame as well since we're at the end of both containers
            session.stack.pop();
          }
        }

        session.address = returnAddress;
      } else {
        if (session.loops < options.loop) {
          session.loops += 1;
          session.address = null;
          session.outroDone = false;
        } else {
          if (outro && !session.outroDone) {
            session.outroDone = true;
            session.stack.push({
              returnAddress: OUTRO_RETURN_ADDR,
              scope: null,
              blockType: "outro",
            });
            session.address = outro.addr;
            continue;
          }
          out.push({ type: "story-end" });
        }
      }
    }

    if (out.length > 0) {
      const last = out[out.length - 1];
      switch (last.type) {
        case "get-input":
          return done(SeamType.INPUT, node.addr, {});
        case "story-end":
          return done(SeamType.FINISH, node.addr, {});
        case "story-error":
          return done(SeamType.ERROR, node.addr, { reason: last.reason });
        case "play-event":
        case "play-media":
          return done(SeamType.MEDIA, node.addr, {});
        default:
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
        nextNode(ctx.node, ctx.source.root, false)?.node.addr ??
        ctx.origin.addr;
      ctx.session.stack.push({
        returnAddress,
        scope: {},
        blockType: "scope",
      });
      // Enter the scope (process children)
      const next =
        ctx.node.kids.length > 0
          ? { node: ctx.node.kids[0] }
          : nextNode(ctx.node, ctx.source.root, false);
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
      const schemaAll = parseFieldGroupsNested(
        omit(publicAtts(atts), "key", "web")
      );
      const schema: Record<string, TSerial> = {};
      for (const k in schemaAll) {
        schema[k] = schemaAll[k];
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
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
      return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm:classify",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const labels = omit(publicAtts(atts), "key", "web");
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
      const out = await ctx.provider.generateJson(
        dedent`
          Classify the input into 0 or more labels based on the best fit per each label's description.
          <input>${prompt}</input>
          <labels>${JSON.stringify(labels, null, 2)}</labels>
          Return only the winning labels. Return multiple labels only if multiple are relevant.
        `,
        { labels: "array<string> - Classification labels for the input" },
        { models, useWebSearch }
      );
      const key = atts.key ?? "classify";
      setState(ctx.scope, key, ensureArray(out.labels ?? []));
      return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm:score",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const cleaned = omit(publicAtts(atts), "key", " web");
      const schema: Record<string, TSerial> = {};
      for (const k in cleaned) {
        if (!k.includes(".")) schema[k] = "number";
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
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
      return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm:generate",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const schemaAll = parseFieldGroupsNested(
        omit(publicAtts(atts), "key", "web")
      );
      const schema: Record<string, TSerial> = {};
      for (const k in schemaAll) {
        schema[k] = schemaAll[k];
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
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
      return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "llm:dialog",
    exec: async (ctx) => {
      const ops: OP[] = [];
      const next = nextNode(ctx.node, ctx.source.root, false);
      const atts = await renderAtts(ctx.node.atts, ctx);
      const assistant =
        atts.npc ??
        atts.ai ??
        atts.assistant ??
        atts.from ??
        atts.with ??
        HOST_ID;
      const user = atts.user ?? atts.player ?? PLAYER_ID;
      const message = atts.message ?? atts.input;
      if (isBlank(assistant) || isBlank(user) || isBlank(message)) {
        return { ops, next };
      }
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      // Checkpoints *should* be in sequential order from oldest to newest
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
      const response = await ctx.provider.generateChat(messages.slice(-20), {});
      const key = atts.key ?? "dialog";
      setState(ctx.scope, key, snorm(response.body));
      return { ops, next };
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
        next: nextNode(ctx.node, ctx.source.root, false),
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
        next: nextNode(ctx.node, ctx.source.root, false),
      };
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
        const { data, statusCode, contentType } = await ctx.provider.fetchUrl({
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
      return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
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
      const next = nextNode(ctx.node, ctx.source.root, true);
      return {
        ops: [],
        next: next,
      };
    },
  },
  {
    match: (node: StoryNode) => TEXT_CONTENT_TAGS.includes(node.type),
    exec: async (ctx) => {
      const next = nextNode(ctx.node, ctx.source.root, false);
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
              pronunciations: ctx.source.pronunciations,
            },
            userVoicesAndPresetVoices(Object.values(ctx.source.voices)),
            {}
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
      return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
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
          next = nextNode(ctx.node, ctx.source.root, false);
        }
      } else {
        // Look for else block
        const elseChild = ctx.node.kids.find((k) => k.type === "else");
        if (elseChild && elseChild.kids.length > 0) {
          next = { node: elseChild.kids[0] };
        } else {
          next = nextNode(ctx.node, ctx.source.root, false);
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
        next = nextNode(ctx.node, ctx.source.root, true);
      } else {
        next = nextNode(ctx.node, ctx.source.root, false);
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
      const w = nearestAncestorOfType(ctx.node, ctx.source.root, "while");
      if (!w) {
        return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
      }
      const count = countStackContainersBetween(ctx.node, w, ctx.source.root);
      const toPop = Math.min(count, ctx.session.stack.length);
      for (let i = 0; i < toPop; i++) ctx.session.stack.pop();
      ctx.session.flowTarget = w.addr;
      return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "break",
    exec: async (ctx) => {
      const w = nearestAncestorOfType(ctx.node, ctx.source.root, "while");
      if (!w) {
        return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
      }
      const after = nextNode(w, ctx.source.root, false);
      if (!after) {
        return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
      }
      const count = countStackContainersBetween(ctx.node, w, ctx.source.root);
      const toPop = Math.min(count, ctx.session.stack.length);
      for (let i = 0; i < toPop; i++) ctx.session.stack.pop();
      ctx.session.flowTarget = after.node.addr;
      return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
    },
  },
  {
    match: (node: StoryNode) => node.type === "jump",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      let next: { node: StoryNode } | null = null;
      if (!atts.if || evalExpr(atts.if, ctx.scope, {}, ctx.rng)) {
        next = searchForNode(
          ctx.source.root,
          atts.to ?? atts.target ?? atts.destination
        );
      } else {
        next = nextNode(ctx.node, ctx.source.root, false);
      }
      if (next && next.node === ctx.node) {
        console.warn("Attempted <jump> to same node; nullifying path");
        next = null;
      }
      return {
        ops: [],
        next,
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
        next: nextNode(ctx.node, ctx.source.root, false),
      };
    },
  },
  {
    // Intro nodes process their children like any container
    match: (node: StoryNode) => node.type === "intro",
    exec: async (ctx) => {
      const next = nextNode(ctx.node, ctx.source.root, true);
      return { ops: [], next };
    },
  },
  {
    match: (node: StoryNode) => node.type === "outro",
    exec: async (ctx) => {
      const inOutroContext = ctx.session.stack.some(
        (frame) => frame.blockType === "outro"
      );
      if (inOutroContext) {
        const next =
          ctx.node.kids.length > 0
            ? { node: ctx.node.kids[0] }
            : nextNode(ctx.node, ctx.source.root, false);
        return { ops: [], next };
      }
      return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
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
            : nextNode(ctx.node, ctx.source.root, false);
        return { ops: [], next };
      } else {
        // Skip resume block in normal flow
        return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
      }
    },
  },
  {
    // Blocks are only rendered if <yield>-ed to
    match: (node: StoryNode) => node.type === "block",
    exec: async (ctx) => {
      // Check if we're in a yield context (i.e., this block was yielded to)
      const inYieldContext =
        ctx.session.stack.length > 0 &&
        ctx.session.stack[ctx.session.stack.length - 1].blockType === "yield";

      if (inYieldContext) {
        // Process children when yielded to - treat block like a container
        const next =
          ctx.node.kids.length > 0
            ? { node: ctx.node.kids[0] }
            : nextNode(ctx.node, ctx.source.root, false);
        return { ops: [], next };
      } else {
        // Skip block in normal flow
        return { ops: [], next: skipBlock(ctx.node, ctx.source.root) };
      }
    },
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
          next: nextNode(ctx.node, ctx.source.root, false),
        };
      }
      // Find the target block
      const blockResult = searchForNode(ctx.source.root, targetBlockId);
      if (!blockResult || blockResult.node.type !== "block") {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.source.root, false),
        };
      }
      // Determine return address
      let returnAddress: string;
      if (returnToNodeId) {
        const returnResult = searchForNode(ctx.source.root, returnToNodeId);
        if (returnResult) {
          returnAddress = returnResult.node.addr;
        } else {
          const next = nextNode(ctx.node, ctx.source.root, false);
          returnAddress = next?.node.addr ?? ctx.origin.addr;
        }
      } else {
        const next = nextNode(ctx.node, ctx.source.root, false);
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
      // Instead of jumping to the block's children, jump to the block itself
      // The block handler will need to process its children when yielded to
      return {
        ops: [],
        next: {
          node: blockResult.node,
        },
      };
    },
  },
  {
    match: (node: StoryNode) => node.type === "read",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const url = atts.src ?? atts.href ?? atts.url;
      let raw = "";
      if (!isBlank(url) && isValidUrl(url)) {
        const { data, statusCode } = await ctx.provider.fetchUrl({
          url,
          method: toHttpMethod(atts.method ?? "GET"),
        });
        if (statusCode >= 200 && statusCode <= 299) {
          raw = data;
        }
      }
      if (isBlank(raw)) {
        raw = await renderText(await marshallText(ctx.node, ctx, ""), ctx);
      }
      if (isBlank(raw)) {
        console.warn("<read> missing content");
        return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
      }
      const blocks = extractReadableBlocks(raw);
      if (blocks.length === 0) {
        console.warn("<read> missing readable blocks");
        return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
      }
      const from = atts.from ?? atts.speaker ?? atts.label ?? HOST_ID;
      const to = atts.to ? cleanSplit(atts.to, ",") : [PLAYER_ID];
      const obs = atts.obs ? cleanSplit(atts.obs, ",") : [];
      const tags = atts.tags ? cleanSplit(atts.tags, ",") : [];
      const volume = parseNumberOrNull(atts.volume);
      const fadeAt = parseNumberOrNull(atts.fadeAt);
      const fadeDuration = parseNumberOrNull(atts.fadeDuration);
      const background = castToBoolean(atts.background);
      const ops: OP[] = [];
      for (let i = 0; i < blocks.length; i++) {
        const body = snorm(blocks[i]);
        if (isBlank(body)) {
          continue;
        }
        const event: StoryEvent = {
          body,
          from,
          to,
          obs,
          tags,
          time: Date.now(),
        };
        const media = ctx.options.doGenerateSpeech
          ? await ctx.provider.generateSpeech(
              {
                speaker: event.from,
                voice: atts.voice ?? event.from,
                tags: event.tags,
                body: event.body,
                pronunciations: ctx.source.pronunciations,
              },
              userVoicesAndPresetVoices(Object.values(ctx.source.voices)),
              {}
            )
          : { url: "" };
        ops.push({
          type: "play-event",
          media: media.url,
          event,
          volume,
          fadeAtMs: fadeAt,
          fadeDurationMs: fadeDuration,
          background,
        });
        recordEvent(ctx.events, event);
      }
      if (ops.length === 0) {
        console.warn("inject generated no events");
        return { ops: [], next: nextNode(ctx.node, ctx.source.root, false) };
      }
      return { ops, next: nextNode(ctx.node, ctx.source.root, false) };
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
      const next = nextNode(ctx.node, ctx.source.root, false);
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
                  parseNumberOrNull(atts.duration) ?? 5_000,
                  {}
                );
                url = audio.url;
                break;
              case "music":
                const music = await ctx.provider.generateMusic(
                  prompt,
                  parseNumberOrNull(atts.duration) ?? 10_000,
                  {}
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
                    pronunciations: ctx.source.pronunciations,
                  },
                  userVoicesAndPresetVoices(Object.values(ctx.source.voices)),
                  {}
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
      const nextAfter = nextNode(ctx.node, ctx.source.root, false);
      const atts = await renderAtts(ctx.node.atts, ctx);
      const tim = parseNumberOrNull(atts.timeLimit ?? atts.for);
      const attrMax = parseNumberOrNull(atts.retryMax);
      const max = Math.max(1, attrMax ?? ctx.options.inputRetryMax);
      if (ctx.session.inputLast && ctx.session.inputLast !== ctx.node.addr) {
        ctx.session.inputTries = {};
      }
      ctx.session.inputLast = ctx.node.addr;
      const inp = ctx.session.input;

      if (!inp) {
        makeCheckpoint(ctx.session, ctx.options, ctx.events);
        ctx.events.length = 0;
      }

      if (ctx.session.input && ctx.session.input.body !== null) {
        const raw = snorm(ctx.session.input.body);
        const extracted: Record<string, TSerial> = {};

        if (ctx.options.verbose) {
          console.info("<input>", raw);
        }

        const parsed = safeJsonParse(raw);
        if (parsed && typeof parsed === "object") {
          Object.assign(extracted, parsed as Record<string, TSerial>);
        } else {
          const enhanced = await extractInput(raw, atts, ctx);
          Object.assign(extracted, enhanced);
        }

        const invalid =
          isEmpty(extracted) ||
          Object.values(extracted).some((val) => val === null);

        if (invalid) {
          ctx.session.input = null;
          const prev = ctx.session.inputTries[ctx.node.addr] ?? 0;
          const cnt = prev + 1;
          ctx.session.inputTries[ctx.node.addr] = cnt;
          if (cnt >= max) {
            const msg = `Input ${ctx.node.addr} failed after ${cnt} attempts`;
            return {
              ops: [
                {
                  type: "story-error",
                  reason: msg,
                },
              ],
              next: null,
            };
          }
          const fallback = searchForNode(ctx.source.root, atts.catch);
          if (fallback) {
            return { ops: [], next: fallback };
          }
          return {
            ops: [
              {
                type: "get-input",
                timeLimit: tim,
              },
            ],
            next: { node: ctx.node },
          };
        }

        ctx.scope["input"] = raw;
        ctx.session.state["input"] = raw;

        for (const key in extracted) {
          ctx.scope[key] = extracted[key];
          if (atts.scope === "global") {
            ctx.session.state[key] = extracted[key];
          }
        }

        ctx.session.inputTries[ctx.node.addr] = 0;
        ctx.session.input = null;
        return { ops: [], next: nextAfter ?? null };
      }

      return {
        ops: [
          {
            type: "get-input",
            timeLimit: tim,
          },
        ],
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
        next: nextNode(ctx.node, ctx.source.root, false),
      };
    },
  },
  {
    // Fallback: Any node not explicitly listed we'll skip over without visiting kids
    match: () => true,
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.source.root, false),
      };
    },
  },
];

export function normalizeModels(
  options: StoryOptions,
  attms: string | undefined,
  defaultModels: NonEmpty<(typeof LLM_SLUGS)[number]> = DEFAULT_LLM_SLUGS
): NonEmpty<(typeof LLM_SLUGS)[number]> {
  const models: (typeof LLM_SLUGS)[number][] = [...options.models];
  const want = cleanSplit(attms, ",")
    .filter((m) => (LLM_SLUGS as readonly string[]).includes(m))
    .reverse();
  for (const w of want) models.unshift(w as (typeof LLM_SLUGS)[number]);
  const out = (models.length > 0 ? models : [...defaultModels]) as NonEmpty<
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
  // No more siblings, check if parent is a block that should end here
  if (parent.type === "block") {
    // If we're at the end of a block, don't continue to its siblings
    // The block handler or yield return logic should handle what comes next
    return null;
  }
  // Otherwise recurse up the tree
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
    t === "outro" ||
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
      node.type === "outro" ||
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

function setState(
  state: Record<string, TSerial>,
  key: string,
  value: TSerial
): void {
  set(state, key, value);
}

export function createScope(
  session: StorySession,
  extra: Record<string, string>
): { [key: string]: TSerial } {
  function findWritableScope(): { [key: string]: TSerial } | null {
    for (let i = session.stack.length - 1; i >= 0; i--) {
      const scope = session.stack[i].scope;
      if (scope) {
        return scope;
      }
    }
    return null;
  }

  return new Proxy({} as { [key: string]: TSerial }, {
    get(target, prop: string) {
      for (let i = session.stack.length - 1; i >= 0; i--) {
        const scope = session.stack[i].scope;
        if (scope && prop in scope) {
          return scope[prop];
        }
      }
      // Return null here instead of undefined so we can reference unknown vars in evalExpr w/o throwing
      return (
        session.state[prop] ??
        session.meta[prop] ??
        extra[prop] ??
        session[prop as keyof typeof session] ??
        null
      );
    },
    set(target, prop: string, value) {
      const scope = findWritableScope();
      if (scope) {
        scope[prop] = value;
      } else {
        session.state[prop] = value;
      }
      return true;
    },
    getOwnPropertyDescriptor(target, prop: string) {
      for (let i = session.stack.length - 1; i >= 0; i--) {
        const scope = session.stack[i].scope;
        if (scope && prop in scope) {
          return {
            configurable: true,
            enumerable: true,
            value: scope[prop],
          };
        }
      }
      if (prop in session.state) {
        return {
          configurable: true,
          enumerable: true,
          value: session.state[prop],
        };
      }
    },
  });
}

async function execNodes(
  nodes: StoryNode[],
  provider: StoryServiceProvider,
  source: StorySource,
  session: StorySession,
  options: StoryOptions,
  rng: PRNG,
  origin: StoryNode
): Promise<void> {
  const prevAddress = session.address;
  const events: StoryEvent[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const handler = ACTION_HANDLERS.find((h) => h.match(node));
    if (!handler) {
      continue;
    }
    const ctx: ActionContext = {
      options,
      origin,
      source,
      node,
      session,
      rng,
      provider,
      scope: createScope(session, source.meta),
      events,
    };
    await handler.exec(ctx);
  }
  session.address = prevAddress;
}

const DDV_SEPARATOR = "|";

export async function renderText(
  text: string,
  ctx: BaseActionContext
): Promise<string> {
  if (isBlank(text) || text.length < 3) {
    return text;
  }
  // 1. {{handlebars}} for interpolation
  let result = renderTemplate(text, ctx.scope ?? {});
  // 2. {$dollars$} for scripting
  result = await enhanceText(
    result,
    async (chunk: string) => {
      return castToString(evalExpr(chunk, ctx.scope ?? {}, {}, ctx.rng!));
    },
    DOLLAR
  );
  // 3. "|" pipe for dynamic variation
  result = ctx.rng.randomElement(result.split(DDV_SEPARATOR));
  // 4. {%liquid%} for inline LLM calls
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
  return result;
}

export async function renderAtts(
  atts: Record<string, string>,
  ctx: BaseActionContext
) {
  const out: Record<string, string> = {};
  for (const key in atts) {
    if (typeof atts[key] === "string") {
      // Don't apply text rendering to .type attributes as they contain enum specs
      if (key.endsWith(".type")) {
        out[key] = atts[key];
      } else {
        out[key] = await renderText(atts[key], ctx);
      }
    }
  }
  return out;
}

export function userVoicesAndPresetVoices(userVoices: VoiceSpec[]) {
  return [...userVoices, ...ELEVENLABS_PRESET_VOICES];
}
