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

import {
  RenderPlan,
  RunnerCoreOptions,
  renderNext as coreRenderNext,
  renderUntilBlocking as coreRenderUntilBlocking,
} from "./RunnerCore";
import { StoryOptions, StorySession, StorySource } from "./StoryTypes";
import { play, playWait } from "./LocalAudioUtils";

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

function toCoreOptions(options: RunnerOptions): RunnerCoreOptions {
  const { doPlayMedia, ...rest } = options;
  return rest;
}

async function renderOps(ops: OP[], options: RunnerOptions) {
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

function logError(info: Record<string, string>) {
  const msg = info.error && typeof info.error === "string" ? info.error : "Unknown error";
  console.log(chalk.red.bold(`ERROR: ${msg}`));
}

export async function renderNext(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: RunnerOptions,
  provider: StoryServiceProvider
): Promise<{ seam: SeamType; ops: OP[]; addr: string | null }> {
  if (input !== null) {
    console.log(chalk.greenBright(`${CAROT}${input}`));
  }
  const result = await coreRenderNext(
    input,
    session,
    sources,
    toCoreOptions(options),
    provider
  );
  await renderOps(result.ops, options);
  if (result.seam === SeamType.ERROR) {
    logError(result.info);
  }
  return { seam: result.seam, ops: result.ops, addr: result.addr };
}

export type RenderResult = Awaited<ReturnType<typeof renderNext>>;

export async function renderUntilBlocking(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: RunnerOptions,
  provider: StoryServiceProvider,
  after?: (resp: RenderResult) => Promise<void> | void
) {
  if (input !== null) {
    console.log(chalk.greenBright(`${CAROT}${input}`));
  }
  const plan = await coreRenderUntilBlocking(
    input,
    session,
    sources,
    toCoreOptions(options),
    provider
  );
  await renderPlan(plan, options, after);
  return { seam: plan.seam, ops: plan.ops, addr: plan.addr };
}

async function renderPlan(
  plan: RenderPlan,
  options: RunnerOptions,
  after?: (resp: RenderResult) => Promise<void> | void
) {
  for (const frame of plan.frames) {
    await renderOps(frame.ops, options);
    if (frame.seam === SeamType.ERROR) {
      logError(frame.info);
    }
    if (after) {
      await after({ seam: frame.seam, ops: frame.ops, addr: frame.addr });
    }
  }
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
  const runOptions: RunnerOptions = { ...info.options, seed: info.seed };
  while (true) {
    if (next === SeamType.ERROR || next === SeamType.FINISH) {
      return next;
    }
    const input = next === SeamType.INPUT ? info.inputs.shift() ?? "" : null;
    const plan = await coreRenderUntilBlocking(
      input,
      info.session,
      info.sources,
      toCoreOptions(runOptions),
      info.provider
    );
    await renderPlan(plan, runOptions);
    if (thunk) {
      await thunk({ ...plan, session: info.session });
    }
    next = plan.seam;
  }
}
