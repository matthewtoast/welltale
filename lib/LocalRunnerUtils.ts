import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { sleep } from "lib/AsyncHelpers";
import { loadEnv } from "lib/DotEnv";
import { safeJsonParse } from "lib/JSONHelpers";
import {
  advanceStory,
  createDefaultSession,
  HOST_ID,
  OP,
  PLAYER_ID,
  PlayMediaOptions,
  SeamType,
} from "lib/StoryEngine";
import { StoryServiceProvider } from "lib/StoryServiceProvider";
import {
  AUDIO_MIMES,
  isBlank,
  mimeTypeFromUrl,
  railsTimestamp,
} from "lib/TextHelpers";
import { dirname } from "path";
import { play, playWait } from "./LocalAudioUtils";
import { StoryOptions, StorySession, StorySource } from "./StoryTypes";

export const CAROT = "> ";

loadEnv();

export function loadSessionFromDisk(
  abspath: string,
  id?: string
): StorySession {
  if (isBlank(id)) {
    id = railsTimestamp();
  }
  const fallback = createDefaultSession(id!);
  const dir = dirname(abspath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(abspath)) {
    writeFileSync(abspath, "{}");
  }
  let json = safeJsonParse(readFileSync(abspath).toString()) ?? {};
  if (typeof json !== "object") {
    json = {};
  }
  return {
    ...fallback,
    ...json,
  };
}

export function saveSessionToDisk(state: StorySession, abspath: string) {
  writeFileSync(abspath, JSON.stringify(state, null, 2));
}

export type RunnerOptions = StoryOptions & {
  doPlayMedia: boolean;
};

export async function playMedia({
  media,
  background,
  volume,
  fadeAtMs,
  fadeDurationMs,
}: PlayMediaOptions) {
  if (isBlank(media)) {
    return;
  }
  if (AUDIO_MIMES.includes(mimeTypeFromUrl(media))) {
    const options = {
      volume: volume ?? 1,
      fadeAt: fadeAtMs ? fadeAtMs / 1000 : 0,
      fadeDuration: fadeDurationMs ? fadeDurationMs / 1000 : 0,
    };
    if (background) {
      play(media, options);
    } else {
      await playWait(media, options);
    }
  }
}

export async function renderNext(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: RunnerOptions,
  provider: StoryServiceProvider
): Promise<{
  seam: SeamType;
  ops: OP[];
  addr: string | null;
}> {
  if (input !== null) {
    console.log(chalk.greenBright(`${CAROT}${input}`));
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
  async function render() {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      switch (op.type) {
        case "get-input":
          break;
        case "play-event":
          console.log(
            chalk.cyan.bold(`${op.event.from || HOST_ID}:`) +
              " " +
              chalk.cyan(`${op.event.body}`)
          );
          if (options.doPlayMedia) {
            await playMedia(op);
          }
          break;
        case "story-end":
          console.log(chalk.magenta.italic("[end]"));
          return "halt";
        case "play-media":
          if (options.doPlayMedia) {
            await playMedia(op);
          }
          break;
        case "sleep":
          console.log(chalk.yellow.italic(`[wait ${op.duration} ms]`));
          await sleep(op.duration);
          break;
      }
    }
  }
  await render();
  if (seam === SeamType.ERROR) {
    const msg =
      typeof info?.error === "string" && info.error
        ? info.error
        : "Unknown error";
    console.log(chalk.red.bold(`ERROR: ${msg}`));
  }
  return { seam, ops, addr };
}

type RenderResult = Awaited<ReturnType<typeof renderNext>>;

export async function continueUntilBlocking(
  resp: RenderResult,
  session: StorySession,
  sources: StorySource,
  options: RunnerOptions,
  provider: StoryServiceProvider,
  after?: (resp: RenderResult) => Promise<void> | void
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
  options: RunnerOptions,
  provider: StoryServiceProvider,
  after?: (resp: RenderResult) => Promise<void> | void
) {
  const first = await renderNext(input, session, sources, options, provider);
  if (after) {
    await after(first);
  }
  return continueUntilBlocking(
    first,
    session,
    sources,
    options,
    provider,
    after
  );
}

export async function runUntilComplete(
  info: {
    options: RunnerOptions;
    provider: StoryServiceProvider;
    session: StorySession;
    sources: StorySource;
    seed: string;
    inputs: string[];
  },
  seam: SeamType = SeamType.GRANT,
  thunk?: (resp: {
    ops: OP[];
    seam: SeamType;
    session: StorySession;
    addr: string | null;
  }) => Promise<void>
) {
  let next = seam;
  const runOptions = { ...info.options, seed: info.seed };
  const after = thunk
    ? async (resp: RenderResult) => {
        await thunk({ ...resp, session: info.session });
      }
    : undefined;
  while (true) {
    if (next === SeamType.ERROR || next === SeamType.FINISH) {
      return next;
    }
    const input = next === SeamType.INPUT ? (info.inputs.shift() ?? "") : null;
    const resp = await renderUntilBlocking(
      input,
      info.session,
      info.sources,
      runOptions,
      info.provider,
      after
    );
    next = resp.seam;
  }
}
