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

export async function continueUntilBlocking(
  resp: RenderResultCore,
  session: StorySession,
  sources: StorySource,
  options: RunnerCoreOptions,
  provider: StoryServiceProvider,
  after?: (resp: RenderResultCore) => Promise<void> | void
) {
  let next = resp;
  while (next.seam === SeamType.MEDIA || next.seam === SeamType.GRANT) {
    next = await renderNext(null, session, sources, options, provider);
    if (after) {
      await after(next);
    }
  }
  return next;
}

export async function renderUntilBlocking(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: RunnerCoreOptions,
  provider: StoryServiceProvider,
  after?: (resp: RenderResultCore) => Promise<void> | void
) {
  const first = await renderNext(input, session, sources, options, provider);
  if (after) {
    await after(first);
  }
  return continueUntilBlocking(first, session, sources, options, provider, after);
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
