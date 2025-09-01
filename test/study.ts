import chalk from "chalk";
import { loadDirRecursive } from "lib/FileUtils";
import { Story } from "lib/StoryEngine";
import { join } from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { railsTimestamp } from "../lib/TextHelpers";
import {
  DEFAULT_SEED,
  defaultRunnerOptions,
  defaultRunnerProvider,
  loadPlaythruFromDisk,
  runUntilComplete,
} from "../test/LocalUtils";

const argv = yargs(hideBin(process.argv))
  .options({
    game: {
      type: "string",
      alias: "g",
      describe: "Game slug to run",
      default: "welcome",
    },
    playthru: {
      type: "string",
      alias: "p",
      describe: "Playthru ID (defaults to random timestamp)",
    },
    input: {
      type: "array",
      alias: "i",
      describe: "Sequential inputs to provide",
      default: [],
    },
    seed: {
      type: "string",
      alias: "s",
      describe: "Seed value for PRNG",
      default: DEFAULT_SEED,
    },
  })
  .parseSync();

async function runStudy(basedir: string) {
  const game = argv.game;
  const id = argv.playthru ?? railsTimestamp();
  const seed = argv.seed;
  const inputs = argv.input as string[];

  const playthruAbspath = join(basedir, `playthrus/${game}-${id}.json`);
  const cartridgeDirpath = join(basedir, `cartridges/${game}`);
  const cartridge = await loadDirRecursive(cartridgeDirpath);
  const story: Story = { id: game, cartridge };
  const playthru = loadPlaythruFromDisk(id, playthruAbspath);

  console.info(chalk.gray(`Running test for game '${game}' playthru '${id}'`));

  return await runUntilComplete({
    options: defaultRunnerOptions,
    provider: defaultRunnerProvider,
    playthru,
    story,
    seed,
    inputs,
  });
}

runStudy(__dirname);
