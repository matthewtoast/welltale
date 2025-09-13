import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { sleep } from "lib/AsyncHelpers";
import { loadEnv } from "lib/DotEnv";
import { safeJsonParse } from "lib/JSONHelpers";
import {
  advanceStory,
  createDefaultSession,
  FALLBACK_SPEAKER,
  OP,
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
) {
  if (input !== null) {
    console.log(chalk.greenBright(`${CAROT}${input}`));
    if (!session.input) {
      session.input = { atts: {}, body: input };
    } else {
      session.input.body = input;
    }
  }
  const { ops, seam, info } = await advanceStory(
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
            chalk.cyan.bold(`${op.event.from || FALLBACK_SPEAKER}:`) +
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
  return { seam, ops };
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
  // Provided so a caller can accumulate what is produced through this run
  // or even throw in a courtesy wait() to avoid rate limiting or something
  thunk?: (resp: {
    ops: OP[];
    seam: SeamType;
    session: StorySession;
  }) => Promise<void>
) {
  if (seam === SeamType.ERROR || seam === SeamType.FINISH) {
    return seam;
  }
  const resp = await renderNext(
    seam === SeamType.INPUT ? (info.inputs.shift() ?? "") : null,
    info.session,
    info.sources,
    { ...info.options, seed: info.seed },
    info.provider
  );
  if (thunk) {
    await thunk({ ...resp, session: info.session });
  }
  return runUntilComplete(info, resp.seam);
}
