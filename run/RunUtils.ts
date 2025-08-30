import { S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { sleep } from "lib/AsyncHelpers";
import { loadEnv } from "lib/DotEnv";
import { safeJsonParse } from "lib/JSONHelpers";
import { DefaultServiceProvider, ServiceProvider } from "lib/ServiceProvider";
import {
  advance,
  createDefaultPlaythru,
  FALLBACK_SPEAKER,
  PlayOptions,
  Playthru,
  StepMode,
  Story,
} from "lib/StoryEngine";
import { isBlank, railsTimestamp } from "lib/TextHelpers";
import OpenAI from "openai";

export const DEFAULT_GAME = "welcome";
export const DEFAULT_SEED = "seed";

loadEnv();

export function loadPlaythru(id: string, abspath: string): Playthru {
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

export function savePlaythru(state: Playthru, abspath: string) {
  writeFileSync(abspath, JSON.stringify(state, null, 2));
}

export type RenderInstruction = "next" | "end" | "input";

export async function renderNext(
  input: string,
  playthru: Playthru,
  story: Story,
  options: PlayOptions,
  provider: ServiceProvider
): Promise<RenderInstruction> {
  if (!isBlank(input)) {
    playthru.state.input = input;
  }
  const ops = await advance(provider, story, playthru, options);
  async function render(): Promise<RenderInstruction> {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      switch (op.type) {
        case "get-input":
          // return early to wait for input
          return "input";
        case "play-line":
          console.log(
            chalk.cyan.bold(`${op.speaker || FALLBACK_SPEAKER}:`) +
              " " +
              chalk.cyan(`${op.line}`)
          );
          break;
        case "end":
          console.log(chalk.magenta("The end."));
          return "end";
        case "play-sound":
          // no-op in REPL mode
          break;
        case "sleep":
          console.log(chalk.yellow.italic(`[waiting ${op.duration} ms]`));
          await sleep(op.duration);
          break;
      }
    }
    return "next";
  }
  return render();
}

export const defaultRunnerOptions: PlayOptions = {
  seed: DEFAULT_SEED,
  mode: StepMode.UNTIL_WAITING,
  verbose: true,
  maxItersPerAdvance: 999, // Enough?
  doGenerateSpeech: false,
  doGenerateSounds: false,
};

export const defaultRunnerProvider = new DefaultServiceProvider({
  eleven: new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! }),
  s3: new S3Client({ region: process.env.AWS_REGION! }),
  openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
  bucket: "welltale-dev",
});
