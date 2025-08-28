import { S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { loadEnv } from "lib/DotEnv";
import { loadDirRecursive } from "lib/FileUtils";
import { DefaultServiceProvider } from "lib/ServiceProvider";
import {
  advance,
  AdvanceOptions,
  createDefaultPlaythru,
  FALLBACK_SPEAKER,
  Playthru,
  StepMode,
  Story,
} from "lib/StoryEngine";
import OpenAI from "openai";
import { join } from "path";
import readline from "readline";
import { safeJsonParse } from "./../lib/JSONHelpers";
import { isBlank, railsTimestamp, smoosh } from "./../lib/TextHelpers";

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

function loadPlaythru(id: string, abspath: string): Playthru {
  if (isBlank(id)) {
    id = railsTimestamp();
  }
  const fallback = createDefaultPlaythru(id);
  if (!existsSync(abspath)) {
    writeFileSync(abspath, "{}");
  }
  let json = safeJsonParse(readFileSync(abspath).toString()) ?? {};
  if (typeof json !== "object") {
    json = {};
  }
  return {
    ...fallback,
    ...json,
  };
}

function savePlaythru(state: Playthru, abspath: string) {
  writeFileSync(abspath, JSON.stringify(state, null, 2));
}

async function renderNext(
  input: string,
  playthru: Playthru,
  story: Story,
  options: AdvanceOptions
): Promise<boolean> {
  if (!isBlank(input)) {
    playthru.state.input = input;
  }
  const ops = await advance(provider, story, playthru, options);
  function render(): boolean {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      switch (op.type) {
        case "get-input":
          // return early to wait for input
          return true;
        case "play-line":
          console.log(
            chalk.cyan.bold(`${op.speaker || FALLBACK_SPEAKER}:`) +
              " " +
              chalk.cyan(`${op.line}`)
          );
          break;
        case "end":
          console.log(chalk.magenta("The end."));
          return false;
        case "play-sound":
        case "sleep":
          // no-ops in REPL mode
          break;
      }
    }
    return true;
  }
  return render();
}

loadEnv();

const options = {
  mode: StepMode.UNTIL_WAITING,
  verbose: true,
  doGenerateSpeech: false,
  doGenerateSounds: false,
};

const provider = new DefaultServiceProvider({
  eleven: new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! }),
  s3: new S3Client({ region: process.env.AWS_REGION! }),
  openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
  bucket: "welltale-dev",
});

async function start(basedir: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.greenBright(CAROT),
  });
  rl.on("close", () => process.exit(0));

  const game = await ask(rl, "Game Slug?", () => "test");
  const id = await ask(rl, "Playthru Id?", () => railsTimestamp());
  const playthruAbspath = join(basedir, `playthrus/${game}-${id}.json`);
  const cartridgeDirpath = join(basedir, `cartridges/${game}`);
  const cartridge = await loadDirRecursive(cartridgeDirpath);
  const story: Story = { id: game, cartridge };
  const playthru = loadPlaythru(id, playthruAbspath);
  console.info(
    chalk.gray(`Init game '${game}' playthru '${id}' (please wait)`)
  );

  let doContinue = await renderNext("", playthru, story, options);
  savePlaythru(playthru, playthruAbspath);
  if (!doContinue) {
    rl.close();
    return;
  }

  rl.prompt();
  rl.on("line", async (raw) => {
    const fixed = raw.trim();
    try {
      doContinue = await renderNext(fixed, playthru, story, options);
      savePlaythru(playthru, playthruAbspath);
    } catch (err) {
      console.error(chalk.red(err));
    }
    if (doContinue) {
      rl.prompt();
    } else {
      rl.close();
    }
  });
}

start(__dirname);
