import { sleep } from "lib/AsyncHelpers";
import { createDefaultSession, OP, PLAYER_ID } from "lib/StoryEngine";
import { ChildProcess, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadDevEnv } from "../env/env-dev";
import { loadSstEnv } from "../env/env-sst";
import { listDirs, safeConfigValue, syncStory } from "../lib/DevTools";
import { RunnerOptions, terminalRenderOps } from "../lib/LocalRunnerUtils";
import { instantiateREPL } from "../lib/REPLUtils";
import { DEFAULT_LLM_SLUGS, StoryAdvanceResult } from "../lib/StoryTypes";
import { advanceStory, fetchDevSessions } from "../lib/StoryWebMethods";
import { cleanSplit } from "../lib/TextHelpers";

const sstEnv = loadSstEnv();
const devEnv = loadDevEnv();

const root = join(process.cwd());

const spawnProc = (
  cwd: string,
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv
): ChildProcess =>
  spawn(cmd, args, {
    cwd,
    env,
    detached: true,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "inherit"],
  });

const killTree = (p?: ChildProcess) => {
  if (!p?.pid) return;
  try {
    if (process.platform === "win32")
      spawn("taskkill", ["/pid", String(p.pid), "/t", "/f"]);
    else process.kill(-p.pid, "SIGTERM");
  } catch {}
};

const waitExit = (p: ChildProcess) =>
  new Promise<number | null>((r) => p.once("exit", (c) => r(c)));

async function go() {
  let next: ChildProcess | undefined;

  const onSig = () => {
    killTree(next);
    killTree(sst);
    process.exit();
  };

  const webDir = join(root, "web");
  const sst = spawnProc(root, "npx", ["sst", "dev"], {
    ...process.env,
    ...sstEnv,
  });
  sst.stdout!.on("data", (b: Buffer) => {
    const s = b.toString();
    process.stdout.write(s);
    if (!next && /Start Next\.js|Next\.js/i.test(s)) {
      next = spawnProc(webDir, "npx", ["sst", "bind", "next", "dev"], {
        ...process.env,
        ...sstEnv,
      });
      next.stdout!.on("data", (x: Buffer) => process.stdout.write(x));
      setTimeout(() => {
        seed(onSig);
      }, 10_000);
    }
  });

  process.on("SIGINT", onSig);
  process.on("SIGTERM", onSig);

  const race = await Promise.race([
    waitExit(sst).then((c) => (killTree(next), { name: "sst", code: c })),
    new Promise<{ name: string; code: number | null }>((resolve) => {
      const check = () =>
        next
          ? waitExit(next!).then(
              (c) => (killTree(sst), resolve({ name: "next", code: c }))
            )
          : setTimeout(check, 200);
      check();
    }),
  ]);

  process.exitCode = race.code ?? 1;
}

go();

async function seed(err: () => void) {
  const argv = await yargs(hideBin(process.argv))
    .option("storyId", {
      type: "string",
      description: "Story id",
    })
    .option("seed", {
      type: "string",
      description: "Seed for random number generator",
      default: "seed",
    })
    .option("verbose", {
      type: "boolean",
      description: "Verbose logging",
      default: true,
    })
    .option("doPlayMedia", {
      type: "boolean",
      description: "Play audio files true/false",
      default: true,
    })
    .option("doGenerateSpeech", {
      type: "boolean",
      description: "Generate speech audio",
      default: true,
    })
    .option("doGenerateAudio", {
      type: "boolean",
      description: "Generate other audio",
      default: true,
    })
    .option("syncStories", {
      type: "boolean",
      description: "Sync stories with the server",
      default: false,
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  console.log("Fetching sessions");
  const devSessions = await fetchDevSessions(
    devEnv.WELLTALE_API_BASE,
    cleanSplit(devEnv.DEV_API_KEYS, ",")
  );

  if (devSessions.length < 1) {
    return err();
  }

  const { user: sessionUser, token: sessionToken } = devSessions[0];

  console.log("Writing iOS configuration");
  const iosDir = join(root, "ios");
  const configPath = join(iosDir, "Welltale", "Generated.xcconfig");
  await mkdir(dirname(configPath), { recursive: true }).catch(() => {});
  const lines = [
    `DEV_SESSION_TOKEN = ${safeConfigValue(sessionToken, "_")}`,
    `DEV_SESSION_USER_ID = ${safeConfigValue(sessionUser.id, "_")}`,
    `DEV_SESSION_USER_PROVIDER = ${safeConfigValue(sessionUser.provider, "_")}`,
    `DEV_SESSION_USER_EMAIL = ${safeConfigValue(sessionUser.email, "test@aisatsu.co")}`,
    `DEV_SESSION_USER_ROLES = ${safeConfigValue(sessionUser.roles?.join(","), "user")}`,
  ];
  console.log(lines);
  await writeFile(configPath, lines.join("\n") + "\n", "utf8");

  if (argv.syncStories) {
    console.log("Syncing stories");
    const ficDir = join(root, "fic");
    const cartridgeDirs = await listDirs(ficDir);
    for (const storyId of cartridgeDirs) {
      const storyDirPath = join(ficDir, storyId);
      await syncStory(
        devEnv.WELLTALE_API_BASE,
        storyId,
        storyDirPath,
        sessionToken
      );
    }
  }

  if (argv.storyId) {
    await sleep(10_000);
    const runnerOptions: RunnerOptions = {
      seed: argv.seed,
      verbose: argv.verbose,
      ream: 100,
      loop: 0,
      maxCheckpoints: 20,
      inputRetryMax: 3,
      models: DEFAULT_LLM_SLUGS,
      doGenerateSpeech: argv.doGenerateSpeech,
      doGenerateAudio: argv.doGenerateAudio,
      doPlayMedia: argv.doPlayMedia,
    };
    const session = createDefaultSession("dev");
    async function render(ops: OP[]): Promise<void> {
      await terminalRenderOps(ops, runnerOptions);
    }
    async function advance(input: string | null): Promise<StoryAdvanceResult> {
      if (input !== null) {
        if (!session.input) {
          session.input = { atts: {}, body: input, from: PLAYER_ID };
        } else {
          session.input.body = input;
        }
      }
      const result = await advanceStory(
        devEnv.WELLTALE_API_BASE,
        argv.storyId!,
        session,
        runnerOptions,
        sessionToken
      );
      if (!result) {
        throw new Error("null result from API");
      }
      return result;
    }
    await instantiateREPL(advance, render, async () => {});
  }
}
