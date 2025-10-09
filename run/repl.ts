import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { loadSstEnv } from "../env/env-sst";
import { instantiateREPL } from "../lib/StoryREPLUtils";

import { last } from "lodash";
import OpenAI from "openai";
import { join } from "path";
import { cwd } from "process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStoryServiceProvider } from "../lib/StoryDefaultServiceProvider";
import {
  loadSessionFromDisk,
  LocalStoryRunnerOptions,
  saveSessionToDisk,
  terminalRenderOps,
} from "../lib/StoryLocalRunnerUtils";
import { advanceToNext } from "../lib/StoryRunnerCoreBlocking";
import { loadDirRecursive } from "./../lib/FileUtils";
import { DEFAULT_CACHE_DIR, LocalCache } from "./../lib/LocalCache";
import { PRNG } from "./../lib/RandHelpers";
import { CompileOptions, compileStory } from "./../lib/StoryCompiler";
import { MockStoryServiceProvider } from "./../lib/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  OP,
  StoryAdvanceResult,
} from "./../lib/StoryTypes";
import { railsTimestamp } from "./../lib/TextHelpers";

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
    .option("sessionPath", {
      type: "string",
      description: "Path to the JSON file at which to save session data",
      default: join(cwd(), "tmp", `welltale-${railsTimestamp()}.json`),
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
  const session = loadSessionFromDisk(argv.sessionPath, gameId);

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

  const baseContext: BaseActionContext = {
    session: createDefaultSession(gameId),
    rng: new PRNG("repl"),
    provider,
    scope: {},
    options: runnerOptions,
    evaluator: async () => null,
  };

  const sources = await compileStory(baseContext, cartridge, compileOptions);
  const save = async () => await saveSessionToDisk(session, argv.sessionPath);
  async function render(ops: OP[]): Promise<void> {
    await terminalRenderOps(ops, runnerOptions);
  }
  async function advance(input: string | null): Promise<StoryAdvanceResult> {
    return await advanceToNext(
      input,
      session,
      sources,
      runnerOptions,
      provider
    );
  }
  await instantiateREPL(advance, render, save);
}

runRepl();
