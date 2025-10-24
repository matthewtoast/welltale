import { readdir } from "fs/promises";
import { zipDir } from "../lib/ZipUtils";
import { loadDirRecursive } from "./FileUtils";
import { collectDataArtifacts, collectDataDocs } from "./engine/StoryConstants";
import {
  apiFinalizeUpload,
  apiRequestUpload,
  apiSaveMeta,
  apiUploadZip,
  StorySpec,
} from "./engine/StoryWebAPI";

export async function syncStory(
  base: string,
  id: string,
  dir: string,
  token: string
): Promise<boolean> {
  console.info(`[dev] sync:${id}:start`);
  const spec = await loadStorySpec(dir);
  if (!spec) {
    console.warn(`skip ${id}: invalid spec`);
    return false;
  }
  console.info(`[dev] sync:${id}:spec`);
  const zip = await zipDir(dir);
  if (!zip) {
    console.warn(`skip ${id}: zip failed`);
    return false;
  }
  console.info(`[dev] sync:${id}:zip ${zip.byteLength}`);
  const saved = await apiSaveMeta(base, id, spec, token);
  if (!saved) {
    console.warn(`skip ${id}: meta save failed`);
    return false;
  }
  console.info(`[dev] sync:${id}:meta`);
  const ticket = await apiRequestUpload(base, id, token);
  if (!ticket) {
    console.warn(`skip ${id}: upload sign failed`);
    return false;
  }
  console.info(`[dev] sync:${id}:signed ${ticket.url}`);
  const sent = await apiUploadZip(ticket, zip);
  if (!sent) {
    console.warn(`skip ${id}: upload failed`);
    return false;
  }
  console.info(`[dev] sync:${id}:uploaded`);
  const queued = await apiFinalizeUpload(base, id, token);
  if (!queued) {
    console.warn(`skip ${id}: finalize failed`);
    return false;
  }
  console.info(`[dev] sync:${id}:finalized`);
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
  const cartridge = await loadDirRecursive(dir);
  const dataDocs = collectDataDocs(cartridge);
  const { meta } = collectDataArtifacts(dataDocs);
  return coerceStorySpec(meta);
}

function coerceStorySpec(value: any): StorySpec | null {
  return {
    author: value?.author ?? "unknown",
    title: value?.title ?? "unknown",
    description: value?.description ?? "",
    tags: Array.isArray(value?.tags) ? value.tags : [],
  };
}

export const safeConfigValue = (
  value: string | null | undefined,
  fallback: string
): string => {
  if (!value) return `${fallback}`;
  return /[\s@/]/.test(value) ? `"${value}"` : value;
};
