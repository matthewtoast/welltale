import chalk from "chalk";
import { loadDirRecursive } from "lib/FileUtils";
import { SeamType, Story } from "lib/StoryEngine";
import { join } from "path";
import readline from "readline";
import { isBlank, railsTimestamp, smoosh } from "../lib/TextHelpers";
import {
  DEFAULT_GAME,
  DEFAULT_SEED,
  defaultRunnerOptions,
  defaultRunnerProvider,
  loadPlaythruFromDisk,
  renderNext,
  savePlaythruToDisk,
} from "./LocalUtils";

const CAROT = "> ";

async function ask(
  rl: readline.Interface,
  question: string,
  ifBlank: () => string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(chalk.green(question + CAROT), (answer) => {
      const got = smoosh(answer);
      if (isBlank(got)) {
        resolve(ifBlank());
      } else {
        resolve(got);
      }
    });
  });
}

async function go(basedir: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.greenBright(CAROT),
  });
  rl.on("close", () => process.exit(0));

  const game = await ask(rl, "Game Slug?", () => DEFAULT_GAME);
  const id = await ask(rl, "Playthru Id?", () => railsTimestamp());
  const seed = await ask(rl, "RNG Seed?", () => DEFAULT_SEED);
  const playthruAbspath = join(basedir, `playthrus/${game}-${id}.json`);
  const cartridgeDirpath = join(basedir, `cartridges/${game}`);
  const cartridge = await loadDirRecursive(cartridgeDirpath);
  const story: Story = { id: game, cartridge };
  const playthru = loadPlaythruFromDisk(id, playthruAbspath);
  console.info(
    chalk.gray(`Init game '${game}' playthru '${id}' (please wait)`)
  );

  let seam = await renderNext(
    "",
    playthru,
    story,
    { ...defaultRunnerOptions, seed },
    defaultRunnerProvider
  );
  savePlaythruToDisk(playthru, playthruAbspath);
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
        playthru,
        story,
        { ...defaultRunnerOptions, seed },
        defaultRunnerProvider
      );
      savePlaythruToDisk(playthru, playthruAbspath);
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

go(__dirname);
