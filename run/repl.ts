import chalk from "chalk";
import { loadDirRecursive } from "lib/FileUtils";
import { Story } from "lib/StoryEngine";
import { join } from "path";
import readline from "readline";
import { isBlank, railsTimestamp, smoosh } from "./../lib/TextHelpers";
import {
  defaultRunnerOptions,
  defaultRunnerProvider,
  loadPlaythru,
  renderNext,
  savePlaythru,
} from "./RunUtils";

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

  const game = await ask(rl, "Game Slug?", () => "test");
  const id = await ask(rl, "Playthru Id?", () => railsTimestamp());
  const seed = await ask(rl, "RNG Seed?", () => "test");
  const playthruAbspath = join(basedir, `playthrus/${game}-${id}.json`);
  const cartridgeDirpath = join(basedir, `cartridges/${game}`);
  const cartridge = await loadDirRecursive(cartridgeDirpath);
  const story: Story = { id: game, cartridge };
  const playthru = loadPlaythru(id, playthruAbspath);
  console.info(
    chalk.gray(`Init game '${game}' playthru '${id}' (please wait)`)
  );

  let nextInstruction = await renderNext(
    "",
    playthru,
    story,
    { ...defaultRunnerOptions, seed },
    defaultRunnerProvider
  );
  savePlaythru(playthru, playthruAbspath);
  if (nextInstruction === "end") {
    rl.close();
    return;
  }

  rl.prompt();
  rl.on("line", async (raw) => {
    const fixed = raw.trim();
    try {
      nextInstruction = await renderNext(
        fixed,
        playthru,
        story,
        { ...defaultRunnerOptions, seed },
        defaultRunnerProvider
      );
      savePlaythru(playthru, playthruAbspath);
    } catch (err) {
      console.error(chalk.red(err));
    }
    if (nextInstruction !== "end") {
      rl.prompt();
    } else {
      rl.close();
    }
  });
}

go(__dirname);
