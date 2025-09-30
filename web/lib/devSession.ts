import { readFileSync } from "node:fs";
import { join } from "node:path";

let loaded = false;
let value: string | null = null;

export function getDevSessionToken(): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (loaded) return value;
  loaded = true;
  try {
    const raw = readFileSync(join(process.cwd(), ".dev-session.json"), "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const token = data.token;
    value = typeof token === "string" ? token : null;
  } catch {
    value = null;
  }
  return value;
}
