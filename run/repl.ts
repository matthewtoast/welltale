import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { loadDirRecursive } from "lib/FileUtils";
import { LocalCache } from "lib/LocalCache";
import { DefaultServiceProvider } from "lib/ServiceProvider";
import { SeamType, Story, StoryOptions } from "lib/StoryEngine";
import { last } from "lodash";
import OpenAI from "openai";
import { homedir } from "os";
import { join } from "path";
import readline from "readline";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  loadSessionFromDisk,
  renderNext,
  saveSessionToDisk,
} from "../lib/LocalUtils";

const CAROT = "> ";

async function runRepl() {
  const argv = await yargs(hideBin(process.argv))
    .option("seed", {
      type: "string",
      description: "Seed for random number generator",
      default: "seed",
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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.greenBright(CAROT),
  });

  rl.on("close", () => process.exit(0));

  const seed = argv.seed;
  const gameId = last(argv.cartridgeDir.split("/"))!;
  const cartridge = await loadDirRecursive(argv.cartridgeDir);
  const story: Story = { id: gameId, cartridge };
  const session = loadSessionFromDisk(argv.sessionPath, gameId);

  console.info(chalk.gray(`Starting REPL...`));

  const options: StoryOptions = {
    seed: argv.seed,
    verbose: true,
    ream: 100,
    loop: 0,
    autoInput: false,
    doGenerateSpeech: false,
    doGenerateAudio: false,
    models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet"],
  };

  const provider = new DefaultServiceProvider({
    eleven: new ElevenLabsClient({ apiKey: argv.elevenlabsKey }),
    openai: new OpenAI({ apiKey: argv.openRouterApiKey }),
    cache: new LocalCache(argv.cacheDir),
  });

  let seam = await renderNext(
    "",
    session,
    story,
    { ...options, seed },
    provider
  );

  saveSessionToDisk(session, argv.sessionPath);

  if (seam === SeamType.FINISH || seam === SeamType.ERROR) {
    rl.close();
    return;
  }

  rl.prompt();

  rl.on("line", async (raw) => {
    const fixed = raw.trim();
    try {
      seam = await renderNext(
        fixed,
        session,
        story,
        { ...options, seed },
        provider
      );
      saveSessionToDisk(session, argv.sessionPath);
    } catch (err) {
      console.error(chalk.red(err));
    }

    if (seam === SeamType.INPUT) {
      rl.prompt();
    } else if (seam === SeamType.GRANT) {
      rl.prompt(); // TODO: Make granting an advance automatic?
    } else {
      rl.close();
    }
  });
}

runRepl();
