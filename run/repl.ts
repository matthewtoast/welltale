import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { last } from "lodash";
import OpenAI from "openai";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadSstEnv } from "../env/env-sst";
import { DefaultStoryServiceProvider } from "../lib/StoryDefaultServiceProvider";
import {
  LocalStoryRunnerOptions,
  terminalRenderOps,
} from "../lib/StoryLocalRunnerUtils";
import { instantiateREPL } from "../lib/StoryREPLUtils";
import { advanceToNext } from "../lib/StoryRunnerCoreBlocking";
import { loadDirRecursive } from "./../lib/FileUtils";
import { DEFAULT_CACHE_DIR, LocalCache } from "./../lib/LocalCache";
import { PRNG } from "./../lib/RandHelpers";
import { CompileOptions, compileStory } from "./../lib/StoryCompiler";
import { MockStoryServiceProvider } from "./../lib/StoryServiceProvider";
import {
  CompilerContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  OP,
  StoryAdvanceResult,
} from "./../lib/StoryTypes";

const env = loadSstEnv();

async function runRepl() {
  const argv = await yargs(hideBin(process.argv))
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
    .option("verbose", {
      type: "boolean",
      description: "Verbose logging",
      default: true,
    })
    .option("doPlayMedia", {
      type: "boolean",
      description: "Play audio files true/false",
      default: true,
    })
    .option("doGenerateAudio", {
      type: "boolean",
      description: "Generate other audio",
      default: true,
    })
    .option("doCompileVoices", {
      type: "boolean",
      description: "Compile voices",
      default: false,
    })
    .option("cartridgeDir", {
      type: "string",
      description: "Path to the dir containing the cartridge files",
      demandOption: true,
    })
    .option("openRouterApiKey", {
      type: "string",
      description: "OpenRouter API key",
      default: env.OPENROUTER_API_KEY,
    })
    .option("openRouterBaseUrl", {
      type: "string",
      description: "OpenRouter base URL",
      default: env.OPENROUTER_BASE_URL,
    })
    .option("elevenlabsKey", {
      type: "string",
      description: "ElevenLabs API key",
      default: env.ELEVENLABS_API_KEY,
    })
    .option("cacheDir", {
      type: "string",
      default: DEFAULT_CACHE_DIR,
      description: "Directory for caching generated content",
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  if (!argv.elevenlabsKey) {
    throw new Error("elevenlabsKey missing");
  }
  if (!argv.openRouterApiKey) {
    throw new Error("openRouterApiKey missing");
  }
  if (!argv.openRouterBaseUrl) {
    throw new Error("openRouterBaseUrl missing");
  }

  const gameId = last(argv.cartridgeDir.split("/"))!;
  const cartridge = await loadDirRecursive(argv.cartridgeDir);

  const compileOptions: CompileOptions = {
    doCompileVoices: argv.doCompileVoices,
  };

  const runnerOptions: LocalStoryRunnerOptions = {
    seed: argv.seed,
    verbose: argv.verbose,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateImage: false,
    models: DEFAULT_LLM_SLUGS,
    doGenerateAudio: argv.doGenerateAudio,
    doPlayMedia: argv.doPlayMedia,
  };

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

  const rng = new PRNG("repl");

  const compilerContext: CompilerContext = {
    rng,
    provider,
    scope: {},
    options: { models: runnerOptions.models },
    evaluator: async () => null,
    ddv: { cycles: {}, bags: {} },
  };

  const sources = await compileStory(
    compilerContext,
    cartridge,
    compileOptions
  );

  const session = createDefaultSession(gameId, sources);

  const save = async () => {};

  async function run(input: string | null): Promise<StoryAdvanceResult> {
    const result = await advanceToNext(input, session, runnerOptions, provider);
    await terminalRenderOps(result.ops, runnerOptions);
    return result;
  }

  await instantiateREPL(run, save);
}

runRepl();
