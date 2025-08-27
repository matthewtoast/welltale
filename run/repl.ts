import { S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { loadEnv } from "lib/DotEnv";
import { loadDirRecursive } from "lib/FileUtils";
import { DefaultServiceProvider } from "lib/ServiceProvider";
import {
  advance,
  createDefaultPlaythru,
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.cyan(CAROT),
});

async function ask(question: string, ifBlank: () => string): Promise<string> {
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

loadEnv();

const provider = new DefaultServiceProvider({
  eleven: new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! }),
  s3: new S3Client({ region: process.env.AWS_REGION! }),
  openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
  bucket: "welltale-dev",
});

async function start(basedir: string) {
  const game = await ask("Game Slug?", () => "test");
  const id = await ask("Playthru Id?", () => railsTimestamp());
  const playthruAbspath = join(basedir, `playthrus/${game}-${id}.json`);
  const cartridgeDirpath = join(basedir, `cartridges/${game}`);
  const cartridge = await loadDirRecursive(cartridgeDirpath);
  const story: Story = { id: game, cartridge };
  const playthru = loadPlaythru(id, playthruAbspath);
  console.info(
    chalk.gray(`Init game "${game}" playthru "${id}" (please wait)`)
  );
  savePlaythru(playthru, playthruAbspath);
  rl.prompt();
  rl.on("line", async (raw) => {
    const fixed = raw.trim();
    try {
      if (!isBlank(fixed)) {
        playthru.state.input = fixed;
      }
      const ops = await advance(provider, story, playthru, {
        mode: StepMode.UNTIL_WAITING,
        verbose: true,
        doGenerateSpeech: false,
        doGenerateSounds: false,
      });
      savePlaythru(playthru, playthruAbspath);
      function render() {
        for (let i = 0; i < ops.length; i++) {
          const op = ops[i];
          switch (op.type) {
            case "get-input":
              // return early to wait for input
              return;
            case "play-line":
              console.log(
                chalk.cyan.bold(`${op.speaker}:`) +
                  " " +
                  chalk.cyan(`${op.line}`)
              );
              break;
            case "play-sound":
            case "sleep":
              // no-ops in REPL mode
              break;
          }
        }
      }
      render();
    } catch (err) {
      console.error(chalk.red(err));
    }
    rl.prompt();
  });
  rl.on("close", () => process.exit(0));
}

start(__dirname);
