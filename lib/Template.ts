import { get } from "lodash";
import { TSerial } from "typings";

export type Stringify = (v: unknown) => string;

export function renderTemplate(
  text: string,
  scope: Record<string, TSerial>,
  opts: { stringify?: Stringify } = {}
): string {
  const stringify = opts.stringify ?? ((v: unknown) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  });
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, p1) => {
    const key = String(p1).trim();
    const val = get(scope, key);
    return stringify(val);
  });
}

