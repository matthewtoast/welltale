import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import OpenAI from "openai";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadSstEnv } from "../env/env-sst";
import { CompileOptions, compileStory } from "../lib/engine/StoryCompiler";
import { DefaultStoryServiceProvider } from "../lib/engine/StoryDefaultServiceProvider";
import {
  CAROT,
  LocalStoryRunnerOptions,
  terminalRenderOps,
} from "../lib/engine/StoryLocalRunnerUtils";
import { advanceToNext } from "../lib/engine/StoryRunnerCoreBlocking";
import { runUntilComplete } from "../lib/engine/StoryRunnerCorePrefetch";
import {
  CompilerContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  OP,
  SeamType,
  StoryAdvanceResult,
} from "../lib/engine/StoryTypes";
import { MockStoryServiceProvider } from "./../lib/engine/StoryServiceProvider";
import { loadDirRecursive } from "./../lib/FileUtils";
import { DEFAULT_CACHE_DIR, LocalCache } from "./../lib/LocalCache";
import { PRNG } from "./../lib/RandHelpers";

const env = loadSstEnv();

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
    .option("doGenerateAudio", {
      type: "boolean",
      description: "Generate audio clips",
      default: false,
    })
    .option("doCompileVoices", {
      type: "boolean",
      description: "Compile voices",
      default: false,
    })
    .option("doGenerateThumbnails", {
      type: "boolean",
      description: "Generate thumbnails during compile",
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
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  const cartridge = await loadDirRecursive(argv.cartridgeDir);

  const runnerOptions: LocalStoryRunnerOptions = {
    seed: argv.seed,
    verbose: argv.verbose,
    ream: 100,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateAudio: argv.doGenerateAudio,
    doGenerateImage: false,
    doPlayMedia: argv.doPlayMedia,
    models: DEFAULT_LLM_SLUGS,
  };

  const compileOptions: CompileOptions = {
    doCompileVoices: argv.doCompileVoices,
    doGenerateThumbnails: argv.doGenerateThumbnails,
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

  const rng = new PRNG("auto");

  const compilerContext: CompilerContext = {
    rng,
    provider,
    options: { models: runnerOptions.models },
    evaluator: async () => null,
    ddv: { cycles: {}, bags: {} },
    locals: {},
  };

  const sources = await compileStory(
    compilerContext,
    cartridge,
    compileOptions
  );

  const session = createDefaultSession("test", sources);

  async function render(ops: OP[]): Promise<void> {
    await terminalRenderOps(ops, runnerOptions);
  }
  async function advance(input: string | null): Promise<StoryAdvanceResult> {
    return await advanceToNext(input, session, runnerOptions, provider);
  }

  const result = await runUntilComplete(
    argv.inputs!.map((i) => i + ""),
    SeamType.GRANT,
    advance,
    render,
    async (input) => {
      console.log(chalk.greenBright(`${CAROT}${(input ?? "").trim()}`));
    }
  );

  return result.seam;
}

runAutorun();
