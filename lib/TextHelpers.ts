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
  return txt.replaceAll(/[^a-zA-Z0-9]/g, ch);
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

export function cleanSplit(s: string, sep: string = "\n") {
  return s
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => !!s);
}

export function cleanSplitRegex(s: string, sep: RegExp) {
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
export const TILDE = /{~\s*([\s\S]*?)\s*~}/g;

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
