import { isEmpty } from "lodash";
import { TSerial } from "../typings";
import { buildDefaultFuncs } from "./EvalMethods";
import { createRunner, evaluateScript } from "./QuickJSUtils";
import { PRNG } from "./RandHelpers";
import { ACTION_HANDLERS } from "./StoryActions";
import { makeCheckpoint } from "./StoryCheckpointUtils";
import {
  dumpTree,
  findNodes,
  wouldEscapeCurrentBlock,
} from "./StoryNodeHelpers";
import { StoryServiceProvider } from "./StoryServiceProvider";
import {
  ActionContext,
  EvaluatorFunc,
  OP,
  SeamType,
  StoryAdvanceResult,
  StoryEvent,
  StoryNode,
  StoryOptions,
  StorySession,
  StorySource,
} from "./StoryTypes";
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

  const funcs = buildDefaultFuncs({}, rng);
  const storyRunner = await createRunner();
  const evaluator: EvaluatorFunc = async (expr, scope) => {
    return await evaluateScript(expr, scope, funcs, storyRunner);
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
        writeableScope: null,
        readableScope: null,
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
        writeableScope: null,
        readableScope: null,
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

    const handler = ACTION_HANDLERS.find(
      (h) => h.tags.length === 0 || h.tags.includes(node.type)
    )!;
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
          session.outroed = false;
        } else {
          if (outro && !session.outroed) {
            session.outroed = true;
            session.stack.push({
              returnAddress: OUTRO_RETURN_ADDR,
              writeableScope: null,
              readableScope: null,
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
        case "play-media":
          return done(SeamType.MEDIA, node.addr, {});
        default:
      }
    }
  }
}

export function createScope(
  session: StorySession,
  extra: Record<string, TSerial>
): { [key: string]: TSerial } {
  function findWritableScope(): { [key: string]: TSerial } | null {
    for (let i = session.stack.length - 1; i >= 0; i--) {
      const writeableScope = session.stack[i].writeableScope;
      if (writeableScope) {
        return writeableScope;
      }
    }
    return null;
  }

  return new Proxy({} as { [key: string]: TSerial }, {
    get(target, prop: string) {
      for (let i = session.stack.length - 1; i >= 0; i--) {
        const eitherScope =
          session.stack[i].writeableScope ?? session.stack[i].readableScope;
        if (eitherScope && prop in eitherScope) {
          return eitherScope[prop];
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
        const scope = session.stack[i].writeableScope;
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
        const scope = session.stack[i].writeableScope;
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
    const handler = ACTION_HANDLERS.find(
      (h) => h.tags.length === 0 || h.tags.includes(node.type)
    );
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
