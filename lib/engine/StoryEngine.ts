import { isEmpty } from "lodash";
import sift, { Query } from "sift";
import { TSerial } from "../../typings";
import { isTruthy } from "../EvalCasting";
import { buildDefaultFuncs } from "../EvalMethods";
import { CostTracker, createCostTracker } from "../MeteringUtils";
import { createRunner, evaluateScript } from "../QuickJSUtils";
import { PRNG } from "../RandHelpers";
import { ACTION_HANDLERS } from "./StoryActions";
import { makeCheckpoint } from "./StoryCheckpointUtils";
import {
  dumpTree,
  findNodes,
  nextNode,
  wouldEscapeCurrentBlock,
} from "./StoryNodeHelpers";
import { renderText } from "./StoryRenderMethods";
import { StoryServiceProvider } from "./StoryServiceProvider";
import {
  ActionContext,
  ActionResult,
  EvaluatorFunc,
  OP,
  SeamType,
  StoryAdvanceResult,
  StoryNode,
  StoryOptions,
  StorySession,
} from "./StoryTypes";

const OUTRO_RETURN_ADDR = "__outro:return__";

let calls = 0;

export async function advanceStory(
  provider: StoryServiceProvider,
  session: StorySession,
  options: StoryOptions,
  out: OP[] = []
): Promise<StoryAdvanceResult> {
  const tracker = createCostTracker();
  provider.attachCostTracker(tracker);

  const rng = new PRNG(options.seed, session.cycle % 10_000);
  session.time = Date.now();
  session.turn += 1;

  if (calls++ < 1 && options.verbose) {
    console.info(dumpTree(session.root));
  }

  // The origin (if present) is the node the author wants to treat as playback origin
  const origin =
    findNodes(session.root, (node) => node.type === "origin")[0] ??
    session.root;

  function fnEvents(query: Query<any>) {
    const sifter = sift(query);
    const events = session.checkpoints.flatMap((cp) =>
      cp.events.filter(sifter)
    );
    return events;
  }
  function fnConvo(query: Query<any>) {
    const events = fnEvents(query);
    return events.map(({ from, body }) => {
      return `${from}: ${body}`;
    });
  }
  const funcs = buildDefaultFuncs(
    {
      events: fnEvents,
      dialog: fnConvo,
    },
    rng
  );
  const storyRunner = await createRunner();
  const evaluator: EvaluatorFunc = async (expr, scope) => {
    return await evaluateScript(expr, scope, funcs, storyRunner);
  };

  // <var> etc may be declared at the top level so evaluate those sequentially
  if (session.turn === 1 && !session.resume) {
    const nodes = session.root.kids.filter((node) =>
      ["var", "code", "script", "data"].includes(node.type)
    );
    for (let i = 0; i < nodes.length; i++) {
      const origAddr = session.address;
      await enactNodeAction(
        nodes[i],
        provider,
        session,
        options,
        rng,
        origin,
        evaluator
      );
      session.address = origAddr;
    }
  }

  // Check for resume first (takes precedence over intro)
  if (session.resume) {
    session.resume = false;
    const resume = findNodes(session.root, (node) => node.type === "resume")[0];
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
    const intro = findNodes(session.root, (node) => node.type === "intro")[0];
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

  return advanceStoryInner(
    provider,
    session,
    options,
    rng,
    tracker,
    origin,
    evaluator,
    out
  );
}

async function advanceStoryInner(
  provider: StoryServiceProvider,
  session: StorySession,
  options: StoryOptions,
  rng: PRNG,
  tracker: CostTracker,
  origin: StoryNode,
  evaluator: EvaluatorFunc,
  out: OP[] = []
): Promise<StoryAdvanceResult> {
  function done(
    seam: SeamType,
    addr: string | null,
    info: Record<string, string>
  ) {
    const cost = tracker.summary();
    provider.attachCostTracker(null);
    makeCheckpoint({ session, options }, []);
    session.cycle = rng.cycle;
    return { ops: out, session, seam, addr, info, cost };
  }

  if (session.address === OUTRO_RETURN_ADDR) {
    session.address = null;
    out.push({ type: "story-end" });
    return done(SeamType.FINISH, null, {});
  }

  let node: StoryNode | null =
    findNodes(session.root, (node) => node.addr === session.address)[0] ?? null;

  if (!node) {
    const error = `Node ${session.address} not found`;
    console.warn(error);
    return done(SeamType.ERROR, null, { error });
  }

  const actionResult = await enactNodeAction(
    node,
    provider,
    session,
    options,
    rng,
    origin,
    evaluator
  );

  out.push(...actionResult.ops);

  if (out.length > 0) {
    const latest = out[out.length - 1];
    if (latest.type === "story-error") {
      return done(SeamType.ERROR, node.addr, { reason: latest.reason });
    }
  }

  if (options.verbose) {
    console.info(
      `<${node.type} ${node.addr}${isEmpty(node.atts) ? "" : " " + JSON.stringify(node.atts)}> ~> ${actionResult.next?.node.addr} ${JSON.stringify(actionResult.ops)}`
    );
  }

  if (actionResult.next) {
    if (session.target) {
      session.address = session.target;
      session.target = null;
      return advanceStoryInner(
        provider,
        session,
        options,
        rng,
        tracker,
        origin,
        evaluator,
        out
      );
    }
    // Check if we're currently in a yielded block and the next node escapes it
    if (
      session.stack.length > 0 &&
      wouldEscapeCurrentBlock(node, actionResult.next.node, session.root)
    ) {
      const topFrame = session.stack[session.stack.length - 1];
      if (topFrame.blockType === "yield") {
        session.address = actionResult.next.node.addr;
      } else {
        const frame = session.stack.pop()!;
        if (frame.blockType === "intro" || frame.blockType === "resume") {
          if (node.type === "jump") {
            session.address = actionResult.next.node.addr;
          } else {
            session.address = frame.returnAddress;
          }
        } else {
          session.address = frame.returnAddress;
        }
      }
    } else {
      session.address = actionResult.next.node.addr;
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
      const outro =
        findNodes(session.root, (node) => node.type === "outro")[0] ?? null;
      if (outro && !session.outroed) {
        session.outroed = true;
        session.stack.push({
          returnAddress: OUTRO_RETURN_ADDR,
          writeableScope: null,
          readableScope: null,
          blockType: "outro",
        });
        session.address = outro.addr;
        return advanceStoryInner(
          provider,
          session,
          options,
          rng,
          tracker,
          origin,
          evaluator,
          out
        );
      }
      out.push({ type: "story-end" });
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

  return advanceStoryInner(
    provider,
    session,
    options,
    rng,
    tracker,
    origin,
    evaluator,
    out
  );
}

export async function enactNodeAction(
  node: StoryNode,
  provider: StoryServiceProvider,
  session: StorySession,
  options: StoryOptions,
  rng: PRNG,
  origin: StoryNode,
  evaluator: EvaluatorFunc
) {
  const ctx: ActionContext = {
    options,
    origin,
    node,
    session,
    rng,
    provider,
    // We need to get a new scope on every node since it may have introduced new scope
    scope: createScope(session),
    evaluator,
  };
  const handler = ACTION_HANDLERS.find(
    (h) => h.tags.length === 0 || h.tags.includes(node.type)
  )!;
  let result: ActionResult | null = null;
  const guardExpr = node.atts.if;
  if (typeof guardExpr === "string") {
    const renderedGuard = await renderText(guardExpr, ctx);
    const guard = isTruthy(await evaluator(renderedGuard, ctx.scope));
    if (!guard) {
      result = { ops: [], next: nextNode(node, session.root, false) };
    }
  }
  if (result === null) {
    result = await handler.exec(ctx);
  }
  const actionResult = result!;
  return actionResult;
}

export function createScope(session: StorySession): { [key: string]: TSerial } {
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
