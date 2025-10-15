import crypto from "crypto";

export const BR = "<br><br>";

export function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export function despace(s: string): string {
  return s.trim().replaceAll(/\s+/g, "_");
}

export function smoosh(s: string): string {
  return s.trim().replaceAll(/\s+/g, " ");
}

export function snorm(s: string): string {
  return s
    .split("\n")
    .map(smoosh)
    .filter((s) => !!s)
    .join("\n")
    .trim();
}

export function fence() {
  return "```";
}

const charsToEncode =
  " ~`!@#$%^&*()+={}|[]\\/:\":'<>?,.、。！？「」『』・«»—¡¿„“‚".split("");

export function slugify(txt: string, ch: string = "_"): string {
  let encoded = txt;
  charsToEncode.forEach((char) => {
    encoded = encoded.split(char).join(ch);
  });
  const re = new RegExp(`${ch}+`, "g");
  return encoded.replaceAll(re, ch);
}

export function parameterize(txt: string, ch: string = "_") {
  return txt
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}\p{C}\p{M}\u200B-\u200D\uFEFF\u2060\u00A0]/gu, ch)
    .replace(/_+/g, ch)
    .trim();
}

export const COMMA_RE = /[、,]/;

export function isBlank(v: any) {
  if (typeof v === "string") {
    return /^\s*$/.test(v);
  }
  if (Array.isArray(v)) {
    return v.length < 1;
  }
  if (v && typeof v === "object") {
    return Object.keys(v).length < 1;
  }
  return !v;
}
export function isPresent<T>(v: T): v is NonNullable<T> {
  return !isBlank(v);
}

export function removeLeading(t: string, c: string): string {
  if (t.startsWith(c)) {
    return removeLeading(t.slice(1), c) as string;
  }
  return t;
}

export function removeTrailing(s: string, t: string) {
  if (s[s.length - 1] === t) {
    return removeTrailing(s.slice(0, -1), t);
  }
  return s;
}

export function cleanSplit(s: string | null | undefined, sep: string = "\n") {
  if (typeof s !== "string") {
    return [];
  }
  return s
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => !!s);
}

export function cleanSplitRegex(s: string, sep: RegExp) {
  if (typeof s !== "string") {
    return [];
  }
  return s
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => !!s);
}

export function stripHTMLTags(str: string) {
  return str.replace(/<[^>]*>/g, "");
}

export function randAlphaNum() {
  return Math.random().toString(36).slice(2);
}

export function titleize(str: string, exclusions: string[] = []): string {
  if (!str) return "";
  const exclusionSet = new Set(exclusions.map((word) => word.toLowerCase()));
  return str
    .split(" ")
    .map((word, index, words) => {
      const isExcluded = exclusionSet.has(word.toLowerCase());
      const isFirstOrLast = index === 0 || index === words.length - 1;
      return isFirstOrLast || !isExcluded
        ? capitalizeWord(word)
        : word.toLowerCase();
    })
    .join(" ");
}

export function capitalizeWord(word: string): string {
  if (!word) return "";
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

export function toPcStr(pc: number) {
  return `${Math.round(pc)}%`;
}

export function railsTimestamp() {
  const now = new Date();
  const pad = (num: number) => String(num).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1); // Months are 0-indexed
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

export function extractParentheticals(s: string): string[] {
  const parentheticals = s.match(/\(([^)]+)\)/g) || [];
  const cleaned = s.replace(/\(([^)]+)\)/g, "").trim();
  return [...parentheticals.map((s) => s.slice(1, -1).trim()), cleaned.trim()];
}

export function generatePredictableKey(
  prefix: string,
  prompt: string,
  suffix: string
): string {
  const slug = slugify(prompt).substring(0, 32);
  const hash = sha1(prompt).substring(0, 8);
  return `${prefix}/${slug}-${hash}.${suffix}`;
}

export const LIQUID = /{%\s*([\s\S]*?)\s*%}/g;
export const DOLLAR = /{\$\s*([\s\S]*?)\s*\$}/g;

export async function enhanceText(
  text: string,
  enhancer: (text: string) => Promise<string>,
  regex: RegExp
) {
  // Fast path: check if pattern exists at all
  if (!regex.test(text)) return text;

  // Reset regex state after test
  regex.lastIndex = 0;

  let match: RegExpExecArray | null;
  let result = "";

  // Collect all matches and their replacements
  const matches: { start: number; end: number; inner: string }[] = [];
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: regex.lastIndex,
      inner: match[1],
    });
  }

  // If no matches, return original text
  if (matches.length === 0) return text;

  // Build the result string with async replacements
  let cursor = 0;
  for (const m of matches) {
    result += text.slice(cursor, m.start);
    const replacement = await enhancer(m.inner);
    result += replacement;
    cursor = m.end;
  }
  result += text.slice(cursor);

  return result;
}

export function mimeTypeFromUrl(url: string): string {
  const ext = url.split(".").pop()?.split(/\#|\?/)[0]?.toLowerCase();
  if (!ext) return "application/octet-stream";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    case "ico":
      return "image/x-icon";
    case "tiff":
    case "tif":
      return "image/tiff";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "avi":
      return "video/x-msvideo";
    case "wmv":
      return "video/x-ms-wmv";
    case "json":
      return "application/json";
    case "xml":
      return "application/xml";
    case "pdf":
      return "application/pdf";
    case "zip":
      return "application/zip";
    case "gz":
      return "application/gzip";
    case "tar":
      return "application/x-tar";
    case "rar":
      return "application/vnd.rar";
    case "7z":
      return "application/x-7z-compressed";
    case "csv":
      return "text/csv";
    case "txt":
      return "text/plain";
    case "html":
    case "htm":
      return "text/html";
    case "css":
      return "text/css";
    case "js":
      return "application/javascript";
    case "mjs":
      return "application/javascript";
    case "woff":
      return "font/woff";
    case "woff2":
      return "font/woff2";
    case "ttf":
      return "font/ttf";
    case "otf":
      return "font/otf";
    case "eot":
      return "application/vnd.ms-fontobject";
    case "md":
      return "text/markdown";
    default:
      return "application/octet-stream";
  }
}

export const AUDIO_MIMES = ["audio/mpeg", "audio/wav", "audio/ogg"];
