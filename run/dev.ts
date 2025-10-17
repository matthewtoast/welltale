import { ChildProcess, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadDevEnv } from "../env/env-dev";
import { loadSstEnv } from "../env/env-sst";
import { listDirs, safeConfigValue, syncStory } from "../lib/DevTools";
import { apiDeleteAllStories, apiFetchDevSessions } from "../lib/StoryWebAPI";
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
  const pid = p.pid;
  try {
    if (process.platform === "win32")
      spawn("taskkill", ["/pid", String(pid), "/t", "/f"]);
    else {
      process.kill(-pid, "SIGTERM");
      setTimeout(() => {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {}
      }, 1000);
    }
  } catch {}
};

const waitExit = (p: ChildProcess) =>
  new Promise<number | null>((r) => p.once("exit", (c) => r(c)));

async function go() {
  let next: ChildProcess | undefined;
  const processes: ChildProcess[] = [];

  const onSig = () => {
    killTree(next);
    killTree(sst);
    processes.forEach(killTree);
    process.exit();
  };

  const webDir = join(root, "web");
  const sst = spawnProc(root, "npx", ["sst", "dev"], {
    ...process.env,
    ...sstEnv,
  });
  processes.push(sst);
  sst.stdout!.on("data", (b: Buffer) => {
    const s = b.toString();
    process.stdout.write(s);
    if (!next && /Start Next\.js|Next\.js/i.test(s)) {
      next = spawnProc(webDir, "npx", ["sst", "bind", "next", "dev"], {
        ...process.env,
        ...sstEnv,
      });
      processes.push(next);
      next.stdout!.on("data", (x: Buffer) => process.stdout.write(x));
      setTimeout(() => {
        setupFixtures(onSig);
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

async function setupFixtures(err: () => void) {
  const argv = await yargs(hideBin(process.argv))
    .option("syncStories", {
      type: "array",
      description:
        "Sync stories with the server. If empty array, sync all stories. If null/undefined, don't sync.",
      default: undefined,
    })
    .option("clearStories", {
      type: "boolean",
      description: "Delete all stories from the server before syncing",
      default: false,
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  console.info("[dev] Fetching sessions");
  const devSessions = await apiFetchDevSessions(
    devEnv.WELLTALE_API_BASE,
    cleanSplit(devEnv.DEV_API_KEYS, ",")
  );
  if (devSessions.length < 1) {
    return err();
  }
  const { user: sessionUser, token: sessionToken } = devSessions[0];

  console.info("[dev] Writing iOS configuration");
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
  console.info("[dev] iOS vars", lines);
  await writeFile(configPath, lines.join("\n") + "\n", "utf8");

  console.info("[dev] Writing web session");
  const webDir = join(root, "web");
  const webConfigPath = join(webDir, ".dev-session.json");
  const webPayload = JSON.stringify({ token: sessionToken }, null, 2);
  await writeFile(webConfigPath, webPayload + "\n", "utf8");

  if (argv.clearStories) {
    console.info("[dev] Clearing stories");
    const cleared = await apiDeleteAllStories(
      devEnv.WELLTALE_API_BASE,
      sessionToken
    );
    if (cleared === null) {
      console.warn("[dev] Failed to clear stories");
    } else {
      console.info(`[dev] Cleared ${cleared} stories`);
    }
  }

  if (argv.syncStories !== undefined) {
    console.info("[dev] Syncing stories");
    const ficDir = join(root, "fic");
    const cartridgeDirs = await listDirs(ficDir);

    const syncStoriesStrings = argv.syncStories.map(String);
    const storiesToSync =
      syncStoriesStrings.length === 0
        ? cartridgeDirs.filter((storyId) => storyId !== "test")
        : syncStoriesStrings.filter((storyId) =>
            cartridgeDirs.includes(storyId)
          );

    for (const storyId of storiesToSync) {
      const storyDirPath = join(ficDir, storyId);
      console.info(`[dev] sync:start ${storyId}`);
      await syncStory(
        devEnv.WELLTALE_API_BASE,
        storyId,
        storyDirPath,
        sessionToken
      );
      console.info(`[dev] sync:done ${storyId}`);
    }
  }
}
