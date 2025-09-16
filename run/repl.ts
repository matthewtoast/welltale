import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { loadEnv } from "lib/DotEnv";
import { loadDirRecursive } from "lib/FileUtils";
import { LocalCache } from "lib/LocalCache";
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
import { homedir } from "os";
import { join } from "path";
import { cwd } from "process";
import readline from "readline";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  CAROT,
  loadSessionFromDisk,
  renderNext,
  RunnerOptions,
  saveSessionToDisk,
} from "../lib/LocalRunnerUtils";

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
    .option("doPlayAudio", {
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
    models: DEFAULT_LLM_SLUGS,
    doGenerateSpeech: argv.doGenerateSpeech,
    doGenerateAudio: argv.doGenerateAudio,
    doPlayMedia: argv.doPlayAudio,
  };

  console.info(
    chalk.gray(`Starting REPL...`, JSON.stringify(runnerOptions, null, 2))
  );

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

  let resp = await renderNext(
    null,
    session,
    sources,
    { ...runnerOptions, seed },
    provider
  );

  saveSessionToDisk(session, argv.sessionPath);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.greenBright(CAROT),
  });

  rl.on("close", () => process.exit(0));

  if (resp.seam === SeamType.FINISH || resp.seam === SeamType.ERROR) {
    rl.close();
    return;
  }

  rl.prompt();

  rl.on("line", async (raw) => {
    const fixed = raw.trim();
    if (fixed.startsWith("/")) {
      const r = await handleCommand(fixed, {
        session,
        sources,
        options: runnerOptions,
        provider,
        seed,
        save: () => saveSessionToDisk(session, argv.sessionPath),
      });
      if (!r.handled) {
        console.warn("Unknown command");
        rl.prompt();
        return;
      }
      if (r.seam) {
        resp = { seam: r.seam, ops: r.ops ?? [] };
      }
    } else {
      try {
        resp = await renderNext(
          fixed,
          session,
          sources,
          { ...runnerOptions, seed },
          provider
        );
        saveSessionToDisk(session, argv.sessionPath);
      } catch (err) {
        console.error(chalk.red(err));
      }
    }

    if (resp.seam === SeamType.INPUT) {
      rl.prompt();
    } else if (resp.seam === SeamType.GRANT) {
      rl.prompt(); // TODO: Make granting an advance automatic?
    } else {
      rl.close();
    }
  });
}

runRepl();
