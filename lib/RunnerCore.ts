import {
  advanceStory,
  PLAYER_ID,
  OP,
  SeamType,
} from "./StoryEngine";
import { StoryServiceProvider } from "./StoryServiceProvider";
import { StoryOptions, StorySession, StorySource } from "./StoryTypes";

export type RunnerCoreOptions = StoryOptions;

export type RenderResultCore = {
  seam: SeamType;
  ops: OP[];
  addr: string | null;
  info: Record<string, string>;
};

export type RenderFrame = RenderResultCore;

export type RenderPlan = RenderResultCore & {
  frames: RenderFrame[];
};

export async function renderNext(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: RunnerCoreOptions,
  provider: StoryServiceProvider
): Promise<RenderResultCore> {
  if (input !== null) {
    if (!session.input) {
      session.input = { atts: {}, body: input, from: PLAYER_ID };
    } else {
      session.input.body = input;
    }
  }
  const { ops, seam, info, addr } = await advanceStory(
    provider,
    sources,
    session,
    options
  );
  return { seam, ops, addr, info };
}

export async function renderUntilBlocking(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: RunnerCoreOptions,
  provider: StoryServiceProvider,
  after?: (resp: RenderResultCore) => Promise<void> | void
) : Promise<RenderPlan> {
  const collected: OP[] = [];
  const frames: RenderFrame[] = [];
  let current = await renderNext(input, session, sources, options, provider);
  collected.push(...current.ops);
  frames.push(current);
  if (after) {
    await after(current);
  }
  while (current.seam === SeamType.MEDIA || current.seam === SeamType.GRANT) {
    current = await renderNext(null, session, sources, options, provider);
    collected.push(...current.ops);
    frames.push(current);
    if (after) {
      await after(current);
    }
  }
  return { ...current, ops: collected, frames };
}

export async function runUntilComplete(
  info: {
    options: RunnerCoreOptions;
    provider: StoryServiceProvider;
    session: StorySession;
    sources: StorySource;
    seed: string;
    inputs: string[];
  },
  seam: SeamType = SeamType.GRANT,
  thunk?: (resp: RenderResultCore & { session: StorySession }) => Promise<void>
) {
  let next = seam;
  const runOptions = { ...info.options, seed: info.seed };
  while (true) {
    if (next === SeamType.ERROR || next === SeamType.FINISH) {
      return next;
    }
    const input = next === SeamType.INPUT ? info.inputs.shift() ?? "" : null;
    const resp = await renderUntilBlocking(
      input,
      info.session,
      info.sources,
      runOptions,
      info.provider,
      thunk
        ? async (r) => {
            await thunk({ ...r, session: info.session });
          }
        : undefined
    );
    next = resp.seam;
  }
}
