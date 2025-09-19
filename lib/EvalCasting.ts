import { TSerial } from "typings";

export function castToBoolean(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0 && !isNaN(v);
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "1"].includes(s)) return true;
    if (["false", "no", "0", ""].includes(s)) return false;
    return Boolean(s);
  }
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v).length > 0;
  return Boolean(v);
}

export function castToNumber(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return isNaN(n) ? 0 : n;
  }
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") return Object.keys(v).length;
  return 0;
}

export function castToString(v: any): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(castToString).join(",");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function cast(v: any, to: CastableType) {
  switch (to) {
    case "boolean":
      return castToBoolean(v);
    case "number":
      return castToNumber(v);
    case "string":
      return castToString(v);
    default:
      throw new Error(`Unknown cast type: ${to}`);
  }
}

export function stringToCastType(s: string): CastableType {
  const normalized = s.trim().toLowerCase();
  if (["bool", "boolean"].includes(normalized)) return "boolean";
  if (["num", "number", "float", "int"].includes(normalized)) return "number";
  if (["str", "string", "text"].includes(normalized)) return "string";
  return "string";
}

export function looksLikeBoolean(s: string): boolean {
  return s === "true" || s === "false";
}

export function looksLikeNumber(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed === "") return false;
  // Only allow if the string is a valid number and does not contain extraneous characters
  // Disallow things like "123abc", "1.2.3", etc.
  // Allow integers, floats, scientific notation, negative numbers
  return /^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed);
}

export type CastableType = "boolean" | "number" | "string";

export function isTruthy(v: any) {
  if (typeof v === "string") {
    return v !== "false" && v !== "";
  }
  if (typeof v === "number") {
    return v !== 0 && !isNaN(v);
  }
  return !!v;
}

export function isFalsy(v: any) {
  return !isTruthy(v);
}

export function castToTypeEnhanced(value: TSerial, type?: string): TSerial {
  if (!type || type === "string") return castToString(value);
  if (type === "number") return castToNumber(value);
  if (type === "boolean") return castToBoolean(value);
  if (type === "int" || type === "integer") {
    return Math.round(castToNumber(value));
  }

  // Handle enums (e.g., "elf|dwarf|human")
  if (type.includes("|")) {
    const options = type.split("|").map((s) => s.trim());
    const normalized = castToString(value).toLowerCase().trim();
    const match = options.find((opt) => opt.toLowerCase() === normalized);
    if (match) return match;

    // Try fuzzy match for common variations
    for (const opt of options) {
      if (
        normalized.includes(opt.toLowerCase()) ||
        opt.toLowerCase().includes(normalized)
      ) {
        return opt;
      }
    }
    return null;
  }

  // Handle arrays if type is like "string[]"
  if (type.endsWith("[]")) {
    const itemType = type.slice(0, -2);
    const arr = Array.isArray(value) ? value : [value];
    return arr.map((item) => castToTypeEnhanced(item, itemType));
  }

  return value;
}
