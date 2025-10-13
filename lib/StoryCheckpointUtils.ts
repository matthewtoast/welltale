import { last } from "lodash";
import {
  ActionContext,
  StoryCheckpoint,
  StoryEvent,
  StoryOptions,
  StorySession,
} from "./StoryTypes";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function snapshotSession(
  session: StorySession
): Omit<StoryCheckpoint, "events"> {
  return {
    addr: session.address,
    turn: session.turn,
    cycle: session.cycle,
    time: session.time,
    state: clone(session.state),
    meta: clone(session.meta),
    outroed: session.outroed,
    stack: clone(session.stack),
  };
}

export function makeCheckpoint(
  ctx: {
    session: StorySession;
    options: StoryOptions;
  },
  events: StoryEvent[]
): StoryCheckpoint {
  const snap = snapshotSession(ctx.session);
  const cp: StoryCheckpoint = {
    ...snap,
    events: events.slice(),
  };
  ctx.session.checkpoints.push(cp);
  const cap = ctx.options.maxCheckpoints;
  if (cap > 0 && ctx.session.checkpoints.length > cap) {
    ctx.session.checkpoints.splice(0, ctx.session.checkpoints.length - cap);
  }
  return cp;
}

export function recordEvent(ctx: ActionContext, ev: StoryEvent) {
  if (ctx.session.checkpoints.length === 0) {
    makeCheckpoint(ctx, []);
  }
  const lc = last(ctx.session.checkpoints)!;
  lc.events.push(ev);
  return ev;
}

export function revertSession(
  session: StorySession,
  key: number | ((cp: StoryCheckpoint, i: number) => boolean)
): StorySession | null {
  let idx = -1;
  if (typeof key === "number") idx = key;
  else idx = session.checkpoints.findIndex((c, i) => key(c, i));
  if (idx < 0 || idx >= session.checkpoints.length) {
    console.warn("Invalid checkpoint to revert");
    return null;
  }
  const cp = session.checkpoints[idx];
  session.address = cp.addr;
  session.turn = cp.turn;
  session.cycle = cp.cycle;
  session.time = cp.time;
  session.state = clone(cp.state);
  session.meta = clone(cp.meta);
  session.stack = clone(cp.stack);
  session.outroed = cp.outroed ?? false;
  session.input = null;
  session.flowTarget = null;
  session.checkpoints.splice(idx + 1);
  return session;
}

export function listCheckpoints(session: StorySession) {
  return session.checkpoints.map((c, i) => ({
    i,
    addr: c.addr,
    turn: c.turn,
    cycle: c.cycle,
  }));
}
