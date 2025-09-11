import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { loadDirRecursive } from "lib/FileUtils";
import { LocalCache } from "lib/LocalCache";
import { compileStory } from "lib/StoryCompiler";
import { SeamType } from "lib/StoryEngine";
import {
  DefaultStoryServiceProvider,
  MockStoryServiceProvider,
} from "lib/StoryServiceProvider";
import { last } from "lodash";
import OpenAI from "openai";
import { homedir } from "os";
import { join } from "path";
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
    .option("playAudio", {
      type: "boolean",
      description: "Play audio files true/false",
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

  const options: RunnerOptions = {
    seed: argv.seed,
    verbose: true,
    ream: 100,
    loop: 0,
    doGenerateSpeech: false,
    doGenerateAudio: false,
    models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet"],
    doPlayMedia: argv.playAudio,
  };

  console.info(
    chalk.gray(`Starting REPL...`, JSON.stringify(options, null, 2))
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

  const sources = await compileStory(provider, cartridge, {
    doCompileVoices: false,
  });

  let resp = await renderNext(
    null,
    session,
    sources,
    { ...options, seed },
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
    try {
      resp = await renderNext(
        fixed,
        session,
        sources,
        { ...options, seed },
        provider
      );
      saveSessionToDisk(session, argv.sessionPath);
    } catch (err) {
      console.error(chalk.red(err));
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
