import { S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { sleep } from "lib/AsyncHelpers";
import { loadEnv } from "lib/DotEnv";
import { safeJsonParse } from "lib/JSONHelpers";
import { DefaultServiceProvider, ServiceProvider } from "lib/ServiceProvider";
import { compileStory } from "lib/StoryCompiler";
import {
  advanceStory,
  createDefaultPlaythru,
  FALLBACK_SPEAKER,
  PlayOptions,
  Playthru,
  StepMode,
  Story,
} from "lib/StoryEngine";
import { isBlank, railsTimestamp } from "lib/TextHelpers";
import OpenAI from "openai";

loadEnv();

export const DEFAULT_GAME = "welcome";
export const DEFAULT_SEED = "seed";

export const defaultRunnerOptions: PlayOptions = {
  seed: DEFAULT_SEED,
  mode: StepMode.UNTIL_WAITING,
  verbose: true,
  loop: 1,
  autoInput: false,
  doGenerateSpeech: false,
  doGenerateSounds: false,
};

export const defaultRunnerProvider = new DefaultServiceProvider({
  eleven: new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! }),
  s3: new S3Client({ region: process.env.AWS_REGION! }),
  openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
  bucket: "welltale-dev",
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

export type RenderInstruction = "next" | "halt" | "input";

export async function renderNext(
  input: string,
  playthru: Playthru,
  story: Story,
  options: PlayOptions,
  provider: ServiceProvider
): Promise<{ instruction: RenderInstruction; playthru: Playthru }> {
  if (!isBlank(input)) {
    playthru.state.input = input;
  }
  const root = await compileStory(story.cartridge);
  const { ops } = await advanceStory(provider, root, playthru, options);
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
    return "next";
  }
  return { instruction: await render(), playthru };
}

export async function runUntilComplete({
  options,
  provider,
  playthru,
  story,
  seed,
  inputs,
}: {
  options: PlayOptions;
  provider: ServiceProvider;
  playthru: Playthru;
  story: Story;
  seed: string;
  inputs: string[];
}) {
  let nextInstruction: RenderInstruction = "next";
  let input = "";
  let inputIndex = 0;

  while (nextInstruction !== "halt") {
    const { instruction } = await renderNext(
      input,
      playthru,
      story,
      { ...options, seed },
      provider
    );
    nextInstruction = instruction;
    if (nextInstruction === "input") {
      if (inputIndex < inputs.length) {
        input = inputs[inputIndex];
        console.log(chalk.green(`> ${input}`));
        inputIndex++;
      } else {
        console.log(chalk.yellow("No more inputs available, exiting..."));
        break;
      }
    }
  }

  return playthru;
}
