import { AnyZodObject, z, ZodSchema } from "zod";
import { smoosh } from "./TextHelpers";

export function parseSchemaString(schemaStr: string): AnyZodObject {
  const trimmed = smoosh(schemaStr);

  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return z.object({ [trimmed]: z.string() });
  }

  try {
    const normalized = trimmed.replace(/^\{/, "").replace(/\}$/, "").trim();

    if (!normalized.includes(":")) {
      return z.object({ [normalized]: z.string() });
    }

    const fields: Record<string, ZodSchema> = {};
    const pairs = normalized.split(/,(?![^{}\[\]]*[\}\]])/);

    for (const pair of pairs) {
      const [key, typeStr] = pair.split(":").map((s) => s.trim());
      if (!key) continue;

      const cleanKey = key.replace(/["']/g, "");

      if (!typeStr) {
        fields[cleanKey] = z.string();
        continue;
      }

      const lowerType = typeStr.toLowerCase().replace(/["']/g, "");

      switch (lowerType) {
        case "string":
        case "str":
        case "text":
          fields[cleanKey] = z.string();
          break;
        case "number":
        case "num":
        case "int":
        case "integer":
        case "float":
          fields[cleanKey] = z.number();
          break;
        case "boolean":
        case "bool":
          fields[cleanKey] = z.boolean();
          break;
        case "array":
        case "list":
        case "string[]":
        case "[string]":
          fields[cleanKey] = z.array(z.string());
          break;
        case "number[]":
        case "[number]":
          fields[cleanKey] = z.array(z.number());
          break;
        case "object":
        case "{}":
          fields[cleanKey] = z.record(z.any());
          break;
        default:
          fields[cleanKey] = z.string();
      }
    }

    return z.object(fields);
  } catch (error) {
    console.warn(`Failed to parse schema: ${schemaStr}, using fallback`);
    return z.object({ result: z.string() });
  }
}
