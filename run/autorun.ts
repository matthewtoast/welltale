import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { loadDirRecursive } from "lib/FileUtils";
import { LocalCache } from "lib/LocalCache";
import {
  loadSessionFromDisk,
  RunnerOptions,
  runUntilComplete,
} from "lib/LocalRunnerUtils";
import { compileStory } from "lib/StoryCompiler";
import {
  DefaultStoryServiceProvider,
  MockStoryServiceProvider,
} from "lib/StoryServiceProvider";
import { last } from "lodash";
import OpenAI from "openai";
import { homedir } from "os";
import { join } from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function runAutorun() {
  const argv = await yargs(hideBin(process.argv))
    .option("inputs", {
      alias: "i",
      type: "array",
      description: "Array of raw inputs to send into the story, in order",
      default: [],
    })
    .option("seed", {
      type: "string",
      description: "Seed for random number generator",
      default: "seed",
    })
    .option("mock", {
      type: "boolean",
      description: "Use mock service provider for service calls",
      default: false,
    })
    .option("playAudio", {
      type: "boolean",
      description: "Play audio files true/false",
      default: false,
    })
    .option("verbose", {
      type: "boolean",
      description: "Verbose logging on (true/false)",
      default: false,
    })
    .option("cartridgeDir", {
      type: "string",
      description: "Path to the dir containing the cartridge files",
      demandOption: true,
    })
    .option("sessionPath", {
      type: "string",
      description: "Path to the JSON file at which to save session data",
      demandOption: true,
    })
    .option("openRouterApiKey", {
      type: "string",
      description: "OpenAI API key",
      demandOption: true,
    })
    .option("openRouterBaseUrl", {
      type: "string",
      description: "OpenRouter base URL",
      demandOption: true,
    })
    .option("elevenlabsKey", {
      type: "string",
      description: "ElevenLabs API key",
      demandOption: true,
    })
    .option("cacheDir", {
      type: "string",
      default: join(homedir(), ".welltale", "cache"),
      description: "Directory for caching generated content",
    })
    .option("sessionResume", {
      type: "boolean",
      default: false,
      description: "Run story as if resuming",
    })
    .option("sessionTurn", {
      type: "number",
      default: 0,
      description: "Which turn to assume the game starts from",
    })
    .option("sessionAddress", {
      type: "string",
      description: "Address at which to resume playback",
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  const seed = argv.seed;
  const gameId = last(argv.cartridgeDir.split("/"))!;
  const cartridge = await loadDirRecursive(argv.cartridgeDir);
  const session = loadSessionFromDisk(argv.sessionPath, gameId);
  session.resume = argv.sessionResume;
  session.turn = argv.sessionTurn;
  session.address = argv.sessionAddress ?? null;

  const options: RunnerOptions = {
    seed: argv.seed,
    verbose: argv.verbose,
    ream: 100,
    loop: 0,
    doGenerateSpeech: false,
    doGenerateAudio: false,
    maxCheckpoints: 20,
    models: ["openai/gpt-4.1", "anthropic/claude-3.5-sonnet"],
    doPlayMedia: argv.playAudio,
  };

  console.info(
    chalk.gray(`Auto-running game...`, JSON.stringify(options, null, 2))
  );

  const provider = argv.mock
    ? new MockStoryServiceProvider()
    : new DefaultStoryServiceProvider({
        eleven: new ElevenLabsClient({ apiKey: argv.elevenlabsKey }),
        openai: new OpenAI({
          apiKey: argv.openRouterApiKey,
          baseURL: argv.openRouterBaseUrl,
        }),
        cache: new LocalCache(argv.cacheDir),
      });

  console.info({
    inputs: argv.inputs,
    options,
  });

  const sources = await compileStory(provider, cartridge, {
    doCompileVoices: false,
  });

  return await runUntilComplete({
    options,
    provider,
    session,
    sources,
    seed,
    inputs: argv.inputs!.map((i) => i + ""),
  });
}

runAutorun();
