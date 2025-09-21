import { spawn, type ChildProcess } from "child_process";
import { loadAppEnv } from "env/env-app";
import { loadDevEnv } from "env/env-dev";
import { loadSstEnv } from "env/env-sst";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { safeYamlParse } from "../lib/JSONHelpers";
import { zipDir } from "../lib/ZipUtils";
import { cleanSplit } from "./../lib/TextHelpers";

const devEnv = loadDevEnv();
const appEnv = loadAppEnv();
const sstEnv = loadSstEnv();

type StorySpec = {
  title: string;
  author: string;
  description: string;
  tags: string[];
  publish: "draft" | "published";
};

type UploadTicket = {
  method: string;
  url: string;
  headers: Record<string, string>;
};

type ApiUser = {
  id: string;
  provider: string;
  email: string | null;
  roles: string[];
};

type ExchangeResponse = {
  ok: boolean;
  token: string;
  user: ApiUser;
};

async function exchange(base: string, key: string): Promise<DevSession | null> {
  const res = await fetch(`${base}/api/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "dev", token: key }),
  }).catch(() => null);
  if (!res) return null;
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as ExchangeResponse | null;
  if (!data) return null;
  if (!data.ok) return null;
  if (!data.token) return null;
  if (!data.user) return null;
  const roles = Array.isArray(data.user.roles)
    ? data.user.roles.filter((role) => typeof role === "string")
    : [];
  const user: ApiUser = {
    id: data.user.id,
    provider: data.user.provider,
    email:
      typeof data.user.email === "string" && data.user.email.length > 0
        ? data.user.email
        : null,
    roles,
  };
  return { token: data.token, user };
}

type DevSession = {
  token: string;
  user: ApiUser;
};

async function fetchDevSessions(
  baseUrl: string,
  devKeys: string[]
): Promise<DevSession[]> {
  if (devKeys.length === 0) return [];
  const results: DevSession[] = [];
  for (const key of devKeys) {
    const token = await exchange(baseUrl, key);
    if (token) results.push(token);
  }
  return results;
}

async function syncStory(
  base: string,
  id: string,
  dir: string,
  token: string
): Promise<boolean> {
  const spec = await loadStorySpec(dir);
  if (!spec) {
    console.warn(`skip ${id}: invalid spec`);
    return false;
  }
  const zip = await zipDir(dir);
  if (!zip) {
    console.warn(`skip ${id}: zip failed`);
    return false;
  }
  const saved = await saveMeta(base, id, spec, token);
  if (!saved) {
    console.warn(`skip ${id}: meta save failed`);
    return false;
  }
  const ticket = await requestUpload(base, id, token);
  if (!ticket) {
    console.warn(`skip ${id}: upload sign failed`);
    return false;
  }
  const sent = await uploadZip(ticket, zip);
  if (!sent) {
    console.warn(`skip ${id}: upload failed`);
    return false;
  }
  const queued = await finalizeUpload(base, id, token);
  if (!queued) {
    console.warn(`skip ${id}: finalize failed`);
    return false;
  }
  console.info(`synced ${id}`);
  return true;
}

async function listDirs(pathname: string): Promise<string[]> {
  const entries = await readdir(pathname, { withFileTypes: true }).catch(
    () => []
  );
  const names = entries.filter((i) => i.isDirectory()).map((i) => i.name);
  names.sort();
  return names;
}

async function loadStorySpec(dir: string): Promise<StorySpec | null> {
  const dataPath = join(dir, "data.yml");
  const raw = await readFile(dataPath).catch(() => null);
  if (!raw) return null;
  const parsed = safeYamlParse(raw.toString());
  if (!parsed) return null;
  return coerceStorySpec(parsed);
}

function coerceStorySpec(value: any): StorySpec | null {
  if (!value) return null;
  if (typeof value.title !== "string") return null;
  if (typeof value.author !== "string") return null;
  if (typeof value.description !== "string") return null;
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((t: any) => typeof t === "string")
    : [];
  const publish = value.publish === "published" ? "published" : "draft";
  return {
    title: value.title,
    author: value.author,
    description: value.description,
    tags,
    publish,
  };
}

async function saveMeta(
  base: string,
  id: string,
  spec: StorySpec,
  token: string
): Promise<boolean> {
  const payload = JSON.stringify(spec);
  const res = await safeRequest(
    `${base}/api/stories/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
    },
    token
  );
  if (!res) return false;
  if (!res.ok) return false;
  return true;
}

async function requestUpload(
  base: string,
  id: string,
  token: string
): Promise<UploadTicket | null> {
  const res = await safeRequest(
    `${base}/api/stories/${id}/upload/sign`,
    {
      method: "POST",
    },
    token
  );
  if (!res) return null;
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  if (typeof data.method !== "string") return null;
  if (typeof data.url !== "string") return null;
  if (!data.headers || typeof data.headers !== "object") return null;
  const headers: Record<string, string> = {};
  for (const key of Object.keys(data.headers)) {
    const v = data.headers[key];
    if (typeof v === "string") headers[key] = v;
  }
  return { method: data.method, url: data.url, headers };
}

async function uploadZip(ticket: UploadTicket, zip: Buffer): Promise<boolean> {
  const headers = { ...ticket.headers, "Content-Length": `${zip.byteLength}` };
  const res = await safeRequest(
    ticket.url,
    {
      method: ticket.method,
      headers,
      body: new Uint8Array(zip),
    },
    null
  );
  if (!res) return false;
  if (!res.ok) return false;
  return true;
}

async function finalizeUpload(
  base: string,
  id: string,
  token: string
): Promise<boolean> {
  const res = await safeRequest(
    `${base}/api/stories/${id}/upload/complete`,
    {
      method: "POST",
    },
    token
  );
  if (!res) return false;
  if (!res.ok) return false;
  return true;
}

function normalizeBaseUrl(input: string): string {
  if (!input) return "";
  if (input.endsWith("/")) return input.slice(0, -1);
  return input;
}

async function safeRequest(
  url: string,
  init: RequestInit,
  token: string | null
): Promise<Response | null> {
  const headers = { ...(init.headers || {}) } as Record<string, string>;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers }).catch(() => null as any);
  if (!res) return null;
  return res;
}

const safeConfigValue = (value: string | null | undefined): string => {
  if (!value) return "";
  const escaped = value.replace(/"/g, '\\"');
  return `"${escaped}"`;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function startSstDev(dir: string): ChildProcess {
  return spawn("yarn", ["web:sst:dev"], {
    cwd: dir,
    env: sstEnv,
    stdio: "inherit",
  });
}

function startNextDev(dir: string): ChildProcess {
  return spawn("npx", ["sst", "bind", "yarn", "web:dev"], {
    cwd: dir,
    env: devEnv,
    stdio: "inherit",
  });
}

async function waitForDevSessionsReady(
  children: ChildProcess[],
  base: string,
  keys: string[]
): Promise<DevSession[] | null> {
  if (keys.length < 1) return null;
  const timeoutMs = 180000;
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const exited = children.some(
      (child) => child.exitCode !== null || child.signalCode !== null
    );
    if (exited) return null;
    const sessions = await fetchDevSessions(base, keys);
    if (sessions.length > 0) return sessions;
    await wait(1000);
  }
  return null;
}

function waitForChildExit(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    child.once("exit", (code) => {
      resolve(code);
    });
  });
}

function bindLifecycle(child: ChildProcess): void {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal);
      }
    });
  }
}

async function main() {
  const rootDir = join(process.cwd());
  const ficDir = join(rootDir, "fic");
  const iosDir = join(rootDir, "ios", "Welltale");

  const apiBaseUrl = normalizeBaseUrl(devEnv.WELLTALE_API_BASE);
  const devKeys = cleanSplit(devEnv.DEV_API_KEYS, ",");

  const devProcess = startSstDev(rootDir);
  bindLifecycle(devProcess);
  const sstExitPromise = waitForChildExit(devProcess);

  const nextProcess = startNextDev(rootDir);
  bindLifecycle(nextProcess);
  const nextExitPromise = waitForChildExit(nextProcess);

  const devSessions = await waitForDevSessionsReady(
    [devProcess, nextProcess],
    apiBaseUrl,
    devKeys
  );
  if (!devSessions || devSessions.length < 1) {
    console.warn("unable to load dev sessions");
    if (!devProcess.killed) {
      devProcess.kill();
    }
    if (!nextProcess.killed) {
      nextProcess.kill();
    }
    await Promise.all([sstExitPromise, nextExitPromise]);
    return;
  }
  const { user: sessionUser, token: sessionToken } = devSessions[0];

  const cartridgeDirs = await listDirs(ficDir);
  for (const storyId of cartridgeDirs) {
    const storyDirPath = join(ficDir, storyId);
    await syncStory(apiBaseUrl, storyId, storyDirPath, sessionToken);
  }

  const configPath = join(
    iosDir,
    "Configurations",
    "Generated",
    "DevSession.xcconfig"
  );
  await mkdir(dirname(configPath), { recursive: true }).catch(() => {});
  const lines = [
    `DEV_SESSION_TOKEN = ${safeConfigValue(sessionToken)}`,
    `DEV_SESSION_USER_ID = ${safeConfigValue(sessionUser.id)}`,
    `DEV_SESSION_USER_PROVIDER = ${safeConfigValue(sessionUser.provider)}`,
    `DEV_SESSION_USER_EMAIL = ${safeConfigValue(sessionUser.email)}`,
    `DEV_SESSION_USER_ROLES = ${safeConfigValue(sessionUser.roles?.join(","))}`,
    `INFOPLIST_KEY_DevSessionToken = $(DEV_SESSION_TOKEN)`,
    `INFOPLIST_KEY_DevSessionUserId = $(DEV_SESSION_USER_ID)`,
    `INFOPLIST_KEY_DevSessionUserProvider = $(DEV_SESSION_USER_PROVIDER)`,
    `INFOPLIST_KEY_DevSessionUserEmail = $(DEV_SESSION_USER_EMAIL)`,
    `INFOPLIST_KEY_DevSessionUserRoles = $(DEV_SESSION_USER_ROLES)`,
  ];
  const content = lines.join("\n") + "\n";
  await writeFile(configPath, content, "utf8");

  const [sstExitCode, nextExitCode] = await Promise.all([
    sstExitPromise,
    nextExitPromise,
  ]);
  if (sstExitCode !== null && sstExitCode !== 0) {
    console.warn(`sst dev exited with code ${sstExitCode}`);
  }
  if (nextExitCode !== null && nextExitCode !== 0) {
    console.warn(`next dev exited with code ${nextExitCode}`);
  }
}

main();
