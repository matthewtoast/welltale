import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

import { sleep } from "./AsyncHelpers";
import { loadEnv } from "./DotEnv";
import { safeJsonParse } from "./JSONHelpers";
import {
  createDefaultSession,
  HOST_ID,
  OP,
  PlayMediaOptions,
  SeamType,
} from "./StoryEngine";
import { StoryServiceProvider } from "./StoryServiceProvider";
import {
  AUDIO_MIMES,
  isBlank,
  mimeTypeFromUrl,
  railsTimestamp,
} from "./TextHelpers";

import { play, playWait } from "./LocalAudioUtils";
import { RenderResult } from "./RunnerCore";
import { createSkipHandle } from "./SkipSignal";
import { createStoryStream } from "./StoryStream";
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

export async function playMedia(
  { media, background, volume, fadeAtMs, fadeDurationMs }: PlayMediaOptions,
  signal?: AbortSignal
) {
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
      await playWait(media, options, signal);
    }
  }
}

async function runWithSkip<T>(
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const h = createSkipHandle();
  const p = fn(h.signal);
  return p.finally(() => h.release());
}

export async function terminalRenderOps(ops: OP[], options: RunnerOptions) {
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
          if (op.background) {
            await playMedia(op);
          } else {
            await runWithSkip((signal) => playMedia(op, signal));
          }
        }
        break;
      case "story-end":
        console.log(chalk.magenta.italic("[end]"));
        return;
      case "story-error":
        console.log(chalk.red.italic(`[error] ${op.reason}`));
        return;
      case "play-media":
        if (options.doPlayMedia) {
          console.log(
            chalk.blueBright.italic(
              `[play ${op.media}]${op.background ? " (background)" : ""}`
            )
          );
          if (op.background) {
            await playMedia(op);
          } else {
            await runWithSkip((signal) => playMedia(op, signal));
          }
        }
        break;
      case "sleep":
        if (options.doPlayMedia) {
          console.log(chalk.yellow.italic(`[wait ${op.duration} ms]`));
          await runWithSkip((signal) => sleep(op.duration, signal));
        } else {
          console.log(
            chalk.yellow.italic(`[wait ${op.duration} ms] (skipped)`)
          );
        }
        break;
    }
  }
}

function logError(info: Record<string, string>) {
  const msg =
    (info.reason && typeof info.reason === "string" && info.reason) ||
    (info.error && typeof info.error === "string" && info.error) ||
    "Unknown error";
  console.log(chalk.red.bold(`ERROR: ${msg}`));
}

export async function renderWithPrefetch(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: RunnerOptions,
  provider: StoryServiceProvider
): Promise<RenderResult> {
  if (input !== null) {
    console.log(chalk.greenBright(`${CAROT}${input}`));
  }
  const stream = createStoryStream({
    session,
    sources,
    options,
    provider,
  });
  stream.push(input);
  const ops: OP[] = [];
  let last: RenderResult | null = null;
  while (true) {
    const next = await stream.take();
    if (!next) {
      break;
    }
    if (next.ops.length > 0) {
      ops.push(...next.ops);
      await terminalRenderOps(next.ops, options);
    }
    last = next;
    if (next.seam === SeamType.MEDIA || next.seam === SeamType.GRANT) {
      continue;
    }
    if (next.seam === SeamType.ERROR) {
      logError(next.info);
    }
    break;
  }
  stream.close();
  if (!last) {
    return {
      seam: SeamType.GRANT,
      ops,
      addr: null,
      info: {},
    };
  }
  return { ...last, ops };
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
  seam: SeamType = SeamType.GRANT
): Promise<{ seam: SeamType }> {
  let next = seam;
  const runOptions: RunnerOptions = { ...info.options, seed: info.seed };
  while (true) {
    if (next === SeamType.ERROR || next === SeamType.FINISH) {
      return { seam: next };
    }
    const input = next === SeamType.INPUT ? (info.inputs.shift() ?? "") : null;
    const result = await renderWithPrefetch(
      input,
      info.session,
      info.sources,
      runOptions,
      info.provider
    );
    next = result.seam;
  }
}
