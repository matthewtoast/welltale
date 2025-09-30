import dedent from "dedent";
import { isEmpty, omit } from "lodash";
import { TSerial } from "../typings";
import { makeCheckpoint, recordEvent } from "./CheckpointUtils";
import {
  castToBoolean,
  castToTypeEnhanced,
  ensureArray,
  isTruthy,
} from "./EvalCasting";
import { isValidUrl, toHttpMethod } from "./HTTPHelpers";
import { parseFieldGroupsNested } from "./InputHelpers";
import { safeJsonParse, safeYamlParse } from "./JSONHelpers";
import { parseNumberOrNull } from "./MathHelpers";
import { AIChatMessage } from "./OpenRouterUtils";
import {
  countStackContainersBetween,
  HOST_ID,
  nearestAncestorOfType,
  nextNode,
  normalizeModels,
  publicAtts,
  renderAtts,
  renderText,
  setState,
  skipBlock,
  userVoicesAndPresetVoices,
} from "./StoryEngine";
import { extractInput } from "./StoryInput";
import {
  DESCENDABLE_TAGS,
  extractReadableBlocks,
  marshallText,
  searchForNode,
  TEXT_CONTENT_TAGS,
} from "./StoryNodeHelpers";
import {
  ActionHandler,
  OP,
  PLAYER_ID,
  StoryEvent,
  StoryNode,
} from "./StoryTypes";
import { cleanSplit, isBlank, snorm } from "./TextHelpers";

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
    match: (node: StoryNode) => node.type === "llm:tag",
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const labels = omit(publicAtts(atts), "key", "web");
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
      const out = await ctx.provider.generateJson(
        dedent`
          Tag the input using 0 or more of the given labels, based on each label's description.
          <input>${prompt}</input>
          <labels>${JSON.stringify(labels, null, 2)}</labels>
          Return only labels that fit the content. Return multiple if relevant.
        `,
        { labels: "array<string> - Classification labels for the input" },
        { models, useWebSearch }
      );
      const key = atts.key ?? "tags";
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
      await ctx.evaluator(text, ctx.scope);
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
      const conditionTrue = await ctx.evaluator(atts.cond, ctx.scope);
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
      const conditionTrue = await ctx.evaluator(atts.cond, ctx.scope);
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
      if (!atts.if || (await ctx.evaluator(atts.if, ctx.scope))) {
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
