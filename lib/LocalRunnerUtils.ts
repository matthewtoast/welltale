import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

import { sleep } from "lib/AsyncHelpers";
import { loadEnv } from "lib/DotEnv";
import { safeJsonParse } from "lib/JSONHelpers";
import {
  createDefaultSession,
  HOST_ID,
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

import { play, playWait } from "./LocalAudioUtils";
import {
  renderUntilBlocking as coreRenderUntilBlocking,
  RenderResult,
} from "./RunnerCore";
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
          await playMedia(op);
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
          await playMedia(op);
        }
        break;
      case "sleep":
        if (options.doPlayMedia) {
          console.log(chalk.yellow.italic(`[wait ${op.duration} ms]`));
          await sleep(op.duration);
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

export async function renderUntilBlocking(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: RunnerOptions,
  provider: StoryServiceProvider
): Promise<RenderResult> {
  if (input !== null) {
    console.log(chalk.greenBright(`${CAROT}${input}`));
  }

  const result = await coreRenderUntilBlocking(
    input,
    session,
    sources,
    options,
    provider
  );

  await terminalRenderOps(result.ops, options);

  if (result.seam === SeamType.ERROR) {
    logError(result.info);
  }

  return result;
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
    const result = await renderUntilBlocking(
      input,
      info.session,
      info.sources,
      runOptions,
      info.provider
    );
    next = result.seam;
  }
}
