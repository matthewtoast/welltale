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
  loadPlaythru,
  RenderInstruction,
  renderNext,
  savePlaythru,
} from "./RunUtils";

const argv = yargs(hideBin(process.argv))
  .options({
    game: {
      type: "string",
      alias: "g",
      demandOption: true,
      describe: "Game slug to run",
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

async function runTest(basedir: string) {
  const game = argv.game;
  const id = argv.playthru ?? railsTimestamp();
  const seed = argv.seed;
  const inputs = argv.input as string[];
  let inputIndex = 0;

  const playthruAbspath = join(basedir, `playthrus/${game}-${id}.json`);
  const cartridgeDirpath = join(basedir, `cartridges/${game}`);
  const cartridge = await loadDirRecursive(cartridgeDirpath);
  const story: Story = { id: game, cartridge };
  const playthru = loadPlaythru(id, playthruAbspath);

  console.info(chalk.gray(`Running test for game '${game}' playthru '${id}'`));

  async function runUntilComplete() {
    let nextInstruction: RenderInstruction = "next";
    let input = "";

    while (nextInstruction !== "end") {
      nextInstruction = await renderNext(
        input,
        playthru,
        story,
        { ...defaultRunnerOptions, seed },
        defaultRunnerProvider
      );
      savePlaythru(playthru, playthruAbspath);
      if (nextInstruction === "input") {
        if (inputIndex < inputs.length) {
          input = inputs[inputIndex];
          console.log(chalk.green(`> ${input}`));
          inputIndex++;
        } else {
          console.log(chalk.yellow("No more inputs available, exiting..."));
          break;
        }
      }
    }

    console.log(chalk.gray("Test complete"));
  }

  await runUntilComplete();
}

runTest(__dirname);
