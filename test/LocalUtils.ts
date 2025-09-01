import { S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { sleep } from "lib/AsyncHelpers";
import { loadEnv } from "lib/DotEnv";
import { safeJsonParse } from "lib/JSONHelpers";
import { DefaultServiceProvider, ServiceProvider } from "lib/ServiceProvider";
import { S3Cache } from "lib/S3Cache";
import { compileStory } from "lib/StoryCompiler";
import {
  advanceStory,
  createDefaultPlaythru,
  FALLBACK_SPEAKER,
  Playthru,
  SeamType,
  Story,
  StoryOptions,
} from "lib/StoryEngine";
import { isBlank, railsTimestamp } from "lib/TextHelpers";
import OpenAI from "openai";

loadEnv();

export const DEFAULT_GAME = "welcome";
export const DEFAULT_SEED = "seed";

export const defaultRunnerOptions: StoryOptions = {
  seed: DEFAULT_SEED,
  verbose: true,
  ream: 100,
  loop: 0,
  autoInput: false,
  doGenerateSpeech: false,
  doGenerateSounds: false,
};

const s3Client = new S3Client({ region: process.env.AWS_REGION! });
const s3Cache = new S3Cache(s3Client, "welltale-dev");

export const defaultRunnerProvider = new DefaultServiceProvider({
  eleven: new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! }),
  openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
  cache: s3Cache,
});

export function loadPlaythruFromDisk(id: string, abspath: string): Playthru {
  if (isBlank(id)) {
    id = railsTimestamp();
  }
  const fallback = createDefaultPlaythru(id);
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

export function savePlaythruToDisk(state: Playthru, abspath: string) {
  writeFileSync(abspath, JSON.stringify(state, null, 2));
}

export async function renderNext(
  input: string,
  playthru: Playthru,
  story: Story,
  options: StoryOptions,
  provider: ServiceProvider
) {
  if (!isBlank(input)) {
    playthru.state.input = input;
  }
  const root = await compileStory(story.cartridge);
  const { ops, seam, info } = await advanceStory(
    provider,
    root,
    playthru,
    options
  );
  async function render() {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      switch (op.type) {
        case "get-input":
          break;
        case "play-line":
          console.log(
            chalk.cyan.bold(`${op.speaker || FALLBACK_SPEAKER}:`) +
              " " +
              chalk.cyan(`${op.line}`)
          );
          break;
        case "story-end":
          console.log(chalk.magenta("The end."));
          return "halt";
        case "play-sound":
          // no-op in REPL mode
          break;
        case "sleep":
          console.log(chalk.yellow.italic(`[waiting ${op.duration} ms]`));
          await sleep(op.duration);
          break;
      }
    }
  }
  await render();
  return seam;
}

export async function runUntilComplete(
  info: {
    options: StoryOptions;
    provider: ServiceProvider;
    playthru: Playthru;
    story: Story;
    seed: string;
    inputs: string[];
  },
  seam: SeamType = SeamType.GRANT
) {
  if (seam === SeamType.INPUT) {
    const input = info.inputs.shift();
    if (input) {
      seam = await renderNext(
        input,
        info.playthru,
        info.story,
        { ...info.options, seed: info.seed },
        info.provider
      );
      return runUntilComplete(info, seam);
    }
  } else if (seam === SeamType.GRANT) {
    seam = await renderNext(
      "",
      info.playthru,
      info.story,
      { ...info.options, seed: info.seed },
      info.provider
    );
    return runUntilComplete(info, seam);
  }
  return seam;
}
