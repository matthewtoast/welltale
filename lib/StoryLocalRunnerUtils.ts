import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { sleep } from "./AsyncHelpers";
import { safeJsonParse } from "./JSONHelpers";
import { play, playWait } from "./LocalAudioUtils";

import { runWithSkip } from "./SkipHelpers";
import { HOST_ID } from "./StoryConstants";
import {
  createDefaultSession,
  OP,
  PlayMediaOptions,
  StoryOptions,
  StorySession,
} from "./StoryTypes";
import {
  AUDIO_MIMES,
  isBlank,
  mimeTypeFromUrl,
  railsTimestamp,
} from "./TextHelpers";

export const CAROT = "> ";

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

export type LocalStoryRunnerOptions = StoryOptions & {
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

export async function terminalRenderOps(
  ops: OP[],
  options: LocalStoryRunnerOptions
) {
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    switch (op.type) {
      case "get-input":
        break;
      case "story-end":
        console.log(chalk.magenta.italic("[end]"));
        return;
      case "story-error":
        console.log(chalk.red.italic(`[error] ${op.reason}`));
        return;
      case "play-media":
        if (op.event) {
          console.log(
            chalk.cyan.bold(`${op.event.from || HOST_ID}:`) +
              " " +
              chalk.cyan(`${op.event.body}`)
          );
        }
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
