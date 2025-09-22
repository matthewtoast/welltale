import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { safeYamlParse } from "../lib/JSONHelpers";
import { zipDir } from "../lib/ZipUtils";
import {
  finalizeUpload,
  requestUpload,
  saveMeta,
  StorySpec,
  uploadZip,
} from "./StoryWebMethods";

export async function syncStory(
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

export async function listDirs(pathname: string): Promise<string[]> {
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
  return {
    author: value?.meta?.author ?? "unknown",
    title: value?.meta?.title ?? "unknown",
    description: value?.meta?.description ?? "",
    tags: Array.isArray(value?.meta?.tags) ? value.meta.tags : [],
  };
}

export const safeConfigValue = (
  value: string | null | undefined,
  fallback: string
): string => {
  if (!value) return `${fallback}`;
  return /[\s@/]/.test(value) ? `"${value}"` : value;
};
