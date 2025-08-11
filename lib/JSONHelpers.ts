import * as yaml from "js-yaml";
import { isPresent } from "./TextHelpers";

export function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

export function safeJsonParseTyped<T>(json: string, validator?: (n: any) => boolean): T | null {
  try {
    const value = JSON.parse(json);
    if (validator) {
      if (validator(value)) {
        return value;
      }
      return null;
    }
    return value;
  } catch (e) {
    return null;
  }
}

export function safeJsonLinesParse<T>(s: string): T[] {
  const lines = s
    .split("\n")
    .map((s) => s.trim())
    .filter(isPresent);
  return lines.map((line) => safeJsonParse(line)).filter(isPresent) as T[];
}

export function toYaml(obj: Record<string, any>): string {
  return yaml.dump(obj);
}
