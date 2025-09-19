import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { loadEnv } from "lib/DotEnv";
import { loadDirRecursive } from "lib/FileUtils";
import { DEFAULT_CACHE_DIR, LocalCache } from "lib/LocalCache";
import { PRNG } from "lib/RandHelpers";
import { handleCommand } from "lib/ReplCommands";
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
import { join } from "path";
import { cwd } from "process";
import readline from "readline";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  CAROT,
  loadSessionFromDisk,
  renderUntilBlocking,
  renderWithPrefetch,
  RunnerOptions,
  saveSessionToDisk,
} from "../lib/LocalRunnerUtils";
import { isSkipActive, triggerSkip } from "../lib/SkipSignal";

async function runRepl() {
  loadEnv();

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
    .option("doGenerateSpeech", {
      type: "boolean",
      description: "Generate speech audio",
      default: true,
    })
    .option("doGenerateAudio", {
      type: "boolean",
      description: "Generate other audio",
      default: true,
    })
    .option("prefetch", {
      type: "boolean",
      description: "Prefetch media while playing",
      default: false,
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

  const seed = argv.seed;
  const usePrefetch = argv.prefetch;
  const runRender = usePrefetch ? renderWithPrefetch : renderUntilBlocking;
  const gameId = last(argv.cartridgeDir.split("/"))!;
  const cartridge = await loadDirRecursive(argv.cartridgeDir);
  const session = loadSessionFromDisk(argv.sessionPath, gameId);

  const compileOptions: CompileOptions = {
    doCompileVoices: argv.doCompileVoices,
  };

  const runnerOptions: RunnerOptions = {
    seed: argv.seed,
    verbose: argv.verbose,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    models: DEFAULT_LLM_SLUGS,
    doGenerateSpeech: argv.doGenerateSpeech,
    doGenerateAudio: argv.doGenerateAudio,
    doPlayMedia: argv.doPlayMedia,
  };

  console.info(
    chalk.gray(`Starting REPL...`, JSON.stringify(runnerOptions, null, 2))
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.greenBright(CAROT),
  });

  rl.on("close", () => process.exit(0));

  let awaitingInput = false;
  process.stdin.setEncoding("utf8");
  if (process.stdin.isTTY) {
    process.stdin.resume();
  }

  process.stdin.on("data", (chunk) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString();
    if (!isSkipActive()) return;
    if (!text.includes("\n") && !text.includes("\r")) return;
    triggerSkip();
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

  const save = () => saveSessionToDisk(session, argv.sessionPath);
  const optionsWithSeed: RunnerOptions = { ...runnerOptions, seed };

  let resp = await runRender(null, session, sources, optionsWithSeed, provider);
  save();

  if (resp.seam !== SeamType.INPUT) {
    rl.close();
    return;
  }

  awaitingInput = true;
  rl.prompt();

  rl.on("line", async (raw) => {
    if (!awaitingInput) {
      return;
    }
    awaitingInput = false;
    const fixed = raw.trim();
    try {
      if (fixed.startsWith("/")) {
        const r = await handleCommand(fixed, {
          session,
          sources,
          options: runnerOptions,
          provider,
          seed,
          save,
        });
        if (!r.handled) {
          console.warn("Unknown command");
          awaitingInput = true;
          rl.prompt();
          return;
        }
        if (r.seam) {
          resp = await runRender(
            null,
            session,
            sources,
            optionsWithSeed,
            provider
          );
          save();
        } else {
          awaitingInput = true;
          rl.prompt();
          return;
        }
      } else {
        resp = await runRender(
          fixed,
          session,
          sources,
          optionsWithSeed,
          provider
        );
        save();
      }
    } catch (err) {
      console.error(chalk.red(err));
      awaitingInput = true;
      rl.prompt();
      return;
    }

    if (resp.seam === SeamType.INPUT) {
      awaitingInput = true;
      rl.prompt();
      return;
    }
    rl.close();
  });
}

runRepl();
