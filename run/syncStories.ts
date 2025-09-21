import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { fetchDevSessions } from "../lib/DevSessions";
import { loadEnv } from "../lib/DotEnv";
import { safeYamlParse } from "../lib/JSONHelpers";
import { zipDir } from "../lib/ZipUtils";

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

async function main() {
  loadEnv();
  const root = join(process.cwd(), "fic");
  const base = normalizeBase(
    process.env.WELLTALE_API_BASE || "http://localhost:3000"
  );
  if (!base) {
    console.warn("missing base url");
    process.exitCode = 1;
    return;
  }
  const sessions = await fetchDevSessions(base);
  const sessionToken = sessions.length > 0 ? sessions[0].token : null;
  if (!sessionToken) {
    console.warn("missing session token");
  }
  const dirs = await listDirs(root);
  let ok = true;
  for (const id of dirs) {
    const dir = join(root, id);
    const result = await syncStory(base, id, dir, sessionToken);
    if (!result && ok) ok = false;
  }
  if (!ok) process.exitCode = 1;
}

async function syncStory(
  base: string,
  id: string,
  dir: string,
  token: string | null
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
  token: string | null
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
  token: string | null
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
  token: string | null
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

function normalizeBase(input: string): string {
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

main();
