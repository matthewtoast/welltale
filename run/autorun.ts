import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { loadDirRecursive } from "lib/FileUtils";
import { LocalCache } from "lib/LocalCache";
import { loadPlaythruFromDisk, runUntilComplete } from "lib/LocalUtils";
import { DefaultServiceProvider } from "lib/ServiceProvider";
import { Story, StoryOptions } from "lib/StoryEngine";
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
    })
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
    .option("playthruPath", {
      type: "string",
      description: "Path to the JSON file at which to save playthru data",
      demandOption: true,
    })
    .option("openaiKey", {
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

  const seed = argv.seed;
  const gameId = last(argv.cartridgeDir.split("/"))!;
  const cartridge = await loadDirRecursive(argv.cartridgeDir);
  const story: Story = { id: gameId, cartridge };
  const playthru = loadPlaythruFromDisk(argv.playthruPath, gameId);

  console.info(chalk.gray(`Auto-running game...`));

  const options: StoryOptions = {
    seed: argv.seed,
    verbose: true,
    ream: 100,
    loop: 0,
    autoInput: true,
    doGenerateSpeech: false,
    doGenerateSounds: false,
  };

  const provider = new DefaultServiceProvider({
    eleven: new ElevenLabsClient({ apiKey: argv.elevenlabsKey }),
    openai: new OpenAI({ apiKey: argv.openaiKey }),
    cache: new LocalCache(argv.cacheDir),
  });

  return await runUntilComplete({
    options,
    provider,
    playthru,
    story,
    seed,
    inputs: argv.inputs!.map((i) => i + ""),
  });
}

runAutorun();
