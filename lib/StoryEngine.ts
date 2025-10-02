import { isEmpty, set } from "lodash";
import { NonEmpty, TSerial } from "../typings";
import { ELEVENLABS_PRESET_VOICES } from "./ElevenLabsVoices";
import { castToString } from "./EvalCasting";
import { buildDefaultFuncs } from "./EvalMethods";
import { createRunner, evaluateScript } from "./QuickJSUtils";
import { PRNG } from "./RandHelpers";
import { ACTION_HANDLERS } from "./StoryActions";
import { makeCheckpoint, recordEvent } from "./StoryCheckpointUtils";
import { resolveBracketDDV } from "./StoryDDVHelpers";
import { dumpTree, findNodes } from "./StoryNodeHelpers";
import { StoryServiceProvider } from "./StoryServiceProvider";
import { HOST_ID } from "./StoryConstants";
import {
  ActionContext,
  BaseActionContext,
  DEFAULT_LLM_SLUGS,
  EvaluatorFunc,
  LLM_SLUGS,
  OP,
  PLAYER_ID,
  SeamType,
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
  DOLLAR,
  enhanceText,
  isBlank,
  LIQUID,
} from "./TextHelpers";
export { HOST_ID } from "./StoryConstants";
const OUTRO_RETURN_ADDR = "__outro:return__";

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

  // The origin (if present) is the node the author wants to treat as playback origin
  const origin =
    findNodes(source.root, (node) => node.type === "origin")[0] ?? source.root;
  const outro =
    findNodes(source.root, (node) => node.type === "outro")[0] ?? null;

  const scriptRunner = await createRunner();
  const funcs = buildDefaultFuncs({}, rng);
  const evaluator: EvaluatorFunc = async (expr, scope) => {
    return await evaluateScript(expr, scope, funcs, scriptRunner);
  };

  // <var> etc may be declared at the top level so evaluate those sequentially
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
      evaluator,
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
      evaluator,
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

export function nearestAncestorOfType(
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

export function isStackContainerType(t: string): boolean {
  return (
    t === "block" ||
    t === "scope" ||
    t === "intro" ||
    t === "resume" ||
    t === "outro" ||
    t === "error"
  );
}

export function countStackContainersBetween(
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

export function setState(
  state: Record<string, TSerial>,
  key: string,
  value: TSerial
): void {
  set(state, key, value);
}

export function createScope(
  session: StorySession,
  extra: Record<string, TSerial>
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
    ownKeys(target) {
      const keys: string[] = [];
      for (let i = session.stack.length - 1; i >= 0; i--) {
        const scope = session.stack[i].scope;
        for (const key in scope) {
          keys.push(key);
        }
      }
      for (const key in session.state) {
        keys.push(key);
      }
      return keys;
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

export async function execNodes(
  nodes: StoryNode[],
  provider: StoryServiceProvider,
  source: StorySource,
  session: StorySession,
  options: StoryOptions,
  rng: PRNG,
  evaluator: EvaluatorFunc,
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
      evaluator,
      events,
    };
    await handler.exec(ctx);
  }
  session.address = prevAddress;
}

export async function renderText(
  text: string,
  ctx: BaseActionContext
): Promise<string> {
  if (isBlank(text) || text.length < 3) {
    return text;
  }
  // {{handlebars}} for interpolation
  let result = renderTemplate(text, ctx.scope);
  // {$dollars$} for scripting
  result = await enhanceText(
    result,
    async (chunk: string) => {
      console.log(chunk, ctx.scope["g"]);
      return castToString(await ctx.evaluator(chunk, ctx.scope));
    },
    DOLLAR
  );
  // [this|kind|of] dynamic variation
  result = resolveBracketDDV(result, ctx);
  // {%liquid%} for inline LLM calls
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
