import { set, uniq } from "lodash";
import { NonEmpty, TSerial } from "../../typings";
import {
  isRecord,
  toNonEmptyString,
  toStringArray,
  toStringValue,
} from "../EvalCasting";
import { safeJsonParse, safeYamlParse } from "../JSONHelpers";
import { cleanSplit, isPresent } from "../TextHelpers";
import {
  DEFAULT_LLM_SLUGS,
  LLM_SLUGS,
  LLM_SLUGS_TAGGED,
  PendingDataVoice,
  StoryCartridge,
  StorySession,
  VoiceSpec,
} from "./StoryTypes";

export const HOST_ID = "HOST";
export const PLAYER_ID = "USER";

export const TEXT_TAG = "#text";

export const NONRENDER_ATTS = ["id", "type", ".type", ".pattern"];

export const LOOP_TAGS = ["while", "loop"];

export const INPUT_TAGS = ["input", "textarea"];

export const TEXT_CONTENT_TAGS = [
  "p",
  "text",
  TEXT_TAG,
  "span",
  "b",
  "strong",
  "em",
  "i",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "output",
];

export const DESCENDABLE_TAGS = [
  "root",
  "html",
  "body",
  "div",
  "ul",
  "ol",
  "li",
  "section",
  "sec",
  "pre",
  "scope",
  "origin",
  // Common HTML tags we'll treat as playable content
  "main",
  "aside",
  "article",
  "details",
  "summary",
];

export function assignInput(
  session: StorySession,
  input: string | null,
  atts: Record<string, TSerial> = {}
) {
  if (input !== null) {
    if (!session.input) {
      session.input = { atts, body: input };
    } else {
      session.input.body = input;
      session.input.atts = atts;
    }
  }
}

export function normalizeModels(
  options: { models: string[] },
  attms: string | undefined,
  defaultModels: NonEmpty<(typeof LLM_SLUGS)[number]> = DEFAULT_LLM_SLUGS
): NonEmpty<(typeof LLM_SLUGS)[number]> {
  if (attms === undefined && options.models.length === 0) {
    return defaultModels;
  }
  const out: NonEmpty<(typeof LLM_SLUGS)[number]> = [...defaultModels];
  const wantedModels = attms ? cleanSplit(attms, ",") : [];
  wantedModels.push(...options.models);
  wantedModels.forEach((modelString) => {
    for (const modelName in LLM_SLUGS_TAGGED) {
      const modelTags =
        LLM_SLUGS_TAGGED[modelName as (typeof LLM_SLUGS)[number]];
      if (modelTags.includes(modelString as any)) {
        out.unshift(modelName as (typeof LLM_SLUGS)[number]);
      }
    }
    if (LLM_SLUGS.includes(modelString as (typeof LLM_SLUGS)[number])) {
      out.unshift(modelString as (typeof LLM_SLUGS)[number]);
    }
  });
  return uniq(out) as any;
}

export function publicAtts<T extends Record<string, any>>(atts: T): T {
  const out: Record<string, any> = {};
  for (const key in atts) {
    if (!key.startsWith("$") && !key.startsWith("_")) {
      out[key] = atts[key];
    }
  }
  return out as T;
}

export function setState(
  session: StorySession,
  key: string,
  value: TSerial
): void {
  const scope = findWritableScope(session);
  set(scope ?? session.state, key, value);
}

export function findWritableScope(
  session: StorySession
): { [key: string]: TSerial } | null {
  for (let i = session.stack.length - 1; i >= 0; i--) {
    const writeableScope = session.stack[i].writeableScope;
    if (writeableScope) {
      return writeableScope;
    }
  }
  return null;
}

export function getReadableScope(
  session: StorySession,
  scope: Record<string, TSerial> = {}
) {
  Object.assign(scope, session);
  Object.assign(scope, session.meta);
  Object.assign(scope, session.state);
  if (Array.isArray(session.stack)) {
    for (let i = session.stack.length - 1; i >= 0; i--) {
      const entry = session.stack[i];
      // @ts-ignore
      Object.assign(scope, entry.readableScope, entry.writeableScope);
    }
  }
  return scope;
}

export function collectDataDocs(cartridge: StoryCartridge) {
  const jsons: unknown[] = Object.keys(cartridge)
    .filter((k) => k.endsWith(".json"))
    .map((key) => safeJsonParse(cartridge[key].toString()))
    .filter(isPresent) as unknown[];

  const yamls: unknown[] = Object.keys(cartridge)
    .filter((k) => k.endsWith(".yml") || k.endsWith(".yaml"))
    .map((key) => safeYamlParse(cartridge[key].toString()))
    .filter(isPresent) as unknown[];

  const dataDocs: unknown[] = [...jsons, ...yamls];
  return dataDocs;
}

type DataArtifacts = {
  pronunciations: Record<string, string>;
  meta: Record<string, TSerial>;
  readyVoices: Record<string, VoiceSpec>;
  pendingVoices: PendingDataVoice[];
};

export function collectDataArtifacts(entries: unknown[]): DataArtifacts {
  const pronunciations: Record<string, string> = {};
  const meta: Record<string, TSerial> = {};
  const readyVoices: Record<string, VoiceSpec> = {};
  const pendingVoices: PendingDataVoice[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!isRecord(entry)) {
      continue;
    }
    const voiceSource = entry["voices"];
    if (isRecord(voiceSource)) {
      const voiceKeys = Object.keys(voiceSource);
      for (let j = 0; j < voiceKeys.length; j++) {
        const key = voiceKeys[j];
        const value = voiceSource[key];
        const spec = toVoiceSpec(value, key);
        if (spec) {
          readyVoices[key] = spec;
          continue;
        }
        const pending = toPendingVoice(value, key);
        if (pending) {
          pendingVoices.push(pending);
          continue;
        }
        console.warn(`Ignoring voice ${key} with invalid data`);
      }
    }
    const pronunciationsSource = entry["pronunciations"];
    if (isRecord(pronunciationsSource)) {
      const pronKeys = Object.keys(pronunciationsSource);
      for (let j = 0; j < pronKeys.length; j++) {
        const key = pronKeys[j];
        const value = toStringValue(pronunciationsSource[key]);
        if (value !== null) {
          pronunciations[key] = value;
        }
      }
    }
    const keys = Object.keys(entry);
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j];
      if (key === "pronunciations" || key === "voices") {
        continue;
      }
      const value = entry[key];
      if (value !== undefined) {
        meta[key] = value as TSerial;
      }
    }
  }
  return { pronunciations, meta, readyVoices, pendingVoices };
}

export function toVoiceSpec(source: unknown, key: string): VoiceSpec | null {
  if (!isRecord(source)) {
    return null;
  }
  const id = toNonEmptyString(source["id"]);
  if (!id) {
    return null;
  }
  const ref = toNonEmptyString(source["ref"]) ?? key;
  const name = toNonEmptyString(source["name"]) ?? id;
  const tags = toStringArray(source["tags"]);
  return { id, ref, name, tags };
}

export function toPendingVoice(
  source: unknown,
  key: string
): PendingDataVoice | null {
  if (!isRecord(source)) {
    return null;
  }
  const prompt =
    toNonEmptyString(source["prompt"]) ??
    toNonEmptyString(source["description"]);
  if (!prompt) {
    return null;
  }
  const ref = toNonEmptyString(source["ref"]) ?? key;
  const name = toNonEmptyString(source["name"]);
  const tags = toStringArray(source["tags"]);
  return { ref, prompt, name, tags };
}
