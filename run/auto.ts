import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { loadDirRecursive } from "lib/FileUtils";
import { LocalCache } from "lib/LocalCache";
import {
  loadSessionFromDisk,
  RunnerOptions,
  runUntilComplete,
} from "lib/LocalRunnerUtils";
import { PRNG } from "lib/RandHelpers";
import { CompileOptions, compileStory } from "lib/StoryCompiler";
import { SeamType } from "lib/StoryEngine";
import {
  DefaultStoryServiceProvider,
  MockStoryServiceProvider,
} from "lib/StoryServiceProvider";
import { DEFAULT_LLM_SLUGS } from "lib/StoryTypes";
import { railsTimestamp } from "lib/TextHelpers";
import { last } from "lodash";
import OpenAI from "openai";
import { homedir } from "os";
import { join } from "path";
import { cwd } from "process";
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
    .option("doPlayMedia", {
      type: "boolean",
      description: "Play audio files true/false",
      default: false,
    })
    .option("doGenerateSpeech", {
      type: "boolean",
      description: "Generate speech audio",
      default: false,
    })
    .option("doGenerateAudio", {
      type: "boolean",
      description: "Generate other audio",
      default: false,
    })
    .option("doCompileVoices", {
      type: "boolean",
      description: "Generate other audio",
      default: false,
    })
    .option("verbose", {
      type: "boolean",
      description: "Verbose logging on (true/false)",
      default: true,
    })
    .option("cartridgeDir", {
      type: "string",
      description: "Path to the dir containing the cartridge files",
      demandOption: true,
    })
    .option("sessionPath", {
      type: "string",
      description: "Path to the JSON file at which to save session data",
      default: join(cwd(), "tmp", `welltale-${railsTimestamp()}.json`),
    })
    .option("openRouterApiKey", {
      type: "string",
      description: "OpenRouter API key",
      default: process.env.OPENROUTER_API_KEY,
    })
    .option("openRouterBaseUrl", {
      type: "string",
      description: "OpenRouter base URL",
      default: process.env.OPENROUTER_BASE_URL,
    })
    .option("elevenlabsKey", {
      type: "string",
      description: "ElevenLabs API key",
      default: process.env.ELEVENLABS_API_KEY,
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

  const runnerOptions: RunnerOptions = {
    seed: argv.seed,
    verbose: argv.verbose,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateSpeech: argv.doGenerateSpeech,
    doGenerateAudio: argv.doGenerateAudio,
    doPlayMedia: argv.doPlayMedia,
    models: DEFAULT_LLM_SLUGS,
  };

  const compileOptions: CompileOptions = {
    doCompileVoices: false,
  };

  console.info(`Auto-running game...`, {
    options: runnerOptions,
    inputs: argv.inputs,
  });

  const provider = argv.mock
    ? new MockStoryServiceProvider()
    : new DefaultStoryServiceProvider(
        {
          eleven: new ElevenLabsClient({ apiKey: argv.elevenlabsKey }),
          openai: new OpenAI({
            apiKey: argv.openRouterApiKey,
            baseURL: argv.openRouterBaseUrl,
          }),
          cache: new LocalCache(argv.cacheDir),
        },
        {
          disableCache: false,
          verbose: argv.verbose,
        }
      );

  const rng = new PRNG(runnerOptions.seed);
  const sources = await compileStory(
    { rng, provider, scope: {}, options: runnerOptions },
    cartridge,
    compileOptions
  );

  const result = await runUntilComplete(
    {
      options: runnerOptions,
      provider,
      session,
      sources,
      seed,
      inputs: argv.inputs!.map((i) => i + ""),
    },
    SeamType.GRANT
  );
  return result.seam;
}

runAutorun();
