import dedent from "dedent";
import { omit } from "lodash";
import { TSerial } from "../typings";
import { castToString, castToTypeEnhanced } from "./EvalCasting";
import { parseFieldGroups, parseFieldGroupsNested } from "./InputHelpers";
import { normalizeModels } from "./StoryEngine";
import { BaseActionContext } from "./StoryTypes";
import { isBlank } from "./TextHelpers";

export const SPECIAL_INPUT_FIELD_ATTS = ["models", "key", "scope"];

function tryParseEnum(value: TSerial, enumString: string): string | null {
  const options = enumString.split("|").map((s) => s.trim());
  const normalized = castToString(value).toLowerCase().trim();

  // Try exact match first
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

async function extractWithLLM(
  raw: string,
  atts: Record<string, string>,
  ctx: BaseActionContext
): Promise<Record<string, TSerial>> {
  const schema = parseFieldGroupsNested(
    omit(atts, ...SPECIAL_INPUT_FIELD_ATTS)
  );
  const enhanced = await ctx.provider.generateJson(
    dedent`
      Extract structured data from the input.
      <input>${raw}</input>
      Example:
      If the input is "my name is Bob and I'm 24", and the schema is {"name.type": "string", "name.description": "the user's name", "age.type": "number"}, your output should be: {"name": "Bob", "age": 25}.
      Normalize and return JSON per the schema.
    `,
    schema,
    {
      useWebSearch: false,
      models: normalizeModels(ctx.options, atts.models),
    }
  );

  return enhanced;
}

export async function extractInput(
  raw: string,
  atts: Record<string, string>,
  ctx: BaseActionContext
): Promise<Record<string, TSerial>> {
  const out: Record<string, TSerial> = {};

  if (Object.keys(atts).length < 1) {
    out["input"] = raw.trim();
    return out;
  }

  const groups = parseFieldGroups(omit(atts, ...SPECIAL_INPUT_FIELD_ATTS));
  // The case of <input key="foo" />
  if (Object.keys(groups).length < 1 && atts.key) {
    groups[atts.key] = { type: "string" };
  }
  const keys = Object.keys(groups);

  // No fields defined - nothing to extract
  if (keys.length === 0) {
    return out;
  }

  // Condition 1: Multiple fields always require LLM
  if (keys.length > 1) {
    const enhanced = await extractWithLLM(raw, atts, ctx);
    Object.assign(out, enhanced);
    return out;
  }

  // Single field case - check attributes for LLM conditions
  const key = keys[0]!;
  const fieldAtts = groups[key];

  // Condition 2: If field has description, use LLM for semantic understanding
  if (fieldAtts.description) {
    const enhanced = await extractWithLLM(raw, atts, ctx);
    Object.assign(out, enhanced);
    return out;
  }

  // Condition 3a: Try local enum parsing for simple enums
  if (fieldAtts.enum && !fieldAtts.range) {
    const enumValue = tryParseEnum(raw, fieldAtts.enum);
    if (enumValue !== null) {
      out[key] = enumValue;
      return out;
    }
    // If enum parsing failed, fall back to LLM
    const enhanced = await extractWithLLM(raw, atts, ctx);
    Object.assign(out, enhanced);
    return out;
  }

  // Condition 3b: If field has complex validation rules (range, or enum+range), use LLM
  if (fieldAtts.range) {
    const enhanced = await extractWithLLM(raw, atts, ctx);
    Object.assign(out, enhanced);
    return out;
  }

  // Condition 4: If field type is complex (array, object, or enum-like type), use LLM
  const type = (fieldAtts.type || "string").toLowerCase();
  if (!["string", "number", "boolean"].includes(type)) {
    // Check if it's a simple enum type like "warrior|mage|rogue"
    if (type.includes("|")) {
      const enumValue = tryParseEnum(raw, type);
      if (enumValue !== null) {
        out[key] = enumValue;
        return out;
      }
    }
    // Complex type or enum parsing failed, use LLM
    const enhanced = await extractWithLLM(raw, atts, ctx);
    Object.assign(out, enhanced);
    return out;
  }

  // Default: Process locally for simple single field
  let value: TSerial = raw;
  const fallback = fieldAtts.default ?? fieldAtts.fallback ?? "";

  // Step 1: Default fallback for blank input
  if (isBlank(value)) {
    value = fallback;
  }

  // Step 2: Parse expression if specified
  if (fieldAtts.parse) {
    value = await ctx.evaluator(castToString(fieldAtts.parse), {
      ...ctx.scope,
      input: value,
    });
    if (isBlank(value)) {
      value = fallback;
    }
  }

  // Step 3: Pattern validation
  if (fieldAtts.pattern) {
    const pattern = castToString(fieldAtts.pattern);
    if (!new RegExp(pattern).test(castToString(value))) {
      value = fallback;
    }
  }

  // Step 4: Type casting
  if (type) {
    value = castToTypeEnhanced(value, type);
  }

  out[key] = value;
  return out;
}
