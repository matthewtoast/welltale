export function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

export function safeJsonParseTyped<T>(
  json: string,
  validator?: (n: any) => boolean
): T | null {
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

export const simplifySchema = (schema: unknown): unknown => {
  const keep = new Set([
    "type",
    "properties",
    "items",
    "anyOf",
    "oneOf",
    "allOf",
    "enum",
    "const",
  ]);
  const isObj = (v: any): v is Record<string, any> =>
    v && typeof v === "object" && !Array.isArray(v);
  const walk = (s: any): any => {
    if (Array.isArray(s)) return s.map(walk);
    if (!isObj(s)) return s;
    const keys = Object.keys(s);
    if (!keys.some((k) => keep.has(k))) {
      const out: Record<string, any> = {};
      for (const k of keys) out[k] = walk(s[k]);
      return out;
    }
    const out: Record<string, any> = {};
    if ("type" in s) out.type = s.type;
    if ("properties" in s) out.properties = walk(s.properties);
    if ("items" in s) out.items = walk(s.items);
    if ("anyOf" in s) out.anyOf = walk(s.anyOf);
    if ("oneOf" in s) out.oneOf = walk(s.oneOf);
    if ("allOf" in s) out.allOf = walk(s.allOf);
    if ("enum" in s) out.enum = s.enum;
    if ("const" in s) out.const = s.const;
    return out;
  };
  return walk(schema);
};
