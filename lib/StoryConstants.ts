import { set } from "lodash";
import { NonEmpty, TSerial } from "../typings";
import { ELEVENLABS_PRESET_VOICES } from "./ElevenLabsVoices";
import {
  DEFAULT_LLM_SLUGS,
  LLM_SLUGS,
  StoryOptions,
  StorySession,
  VoiceSpec,
} from "./StoryTypes";
import { cleanSplit } from "./TextHelpers";

export const HOST_ID = "HOST";
export const PLAYER_ID = "USER";

export const TEXT_TAG = "#text";

export const NONRENDER_ATTS = ["id", "type", ".type", ".pattern"];

export const LOOP_TAGS = ["while"];

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

export function assignInput(session: StorySession, input: string | null) {
  if (input !== null) {
    if (!session.input) {
      session.input = { atts: {}, body: input, from: PLAYER_ID };
    } else {
      session.input.body = input;
    }
  }
}

export function normalizeModels(
  options: StoryOptions,
  attms: string | undefined,
  defaultModels: NonEmpty<(typeof LLM_SLUGS)[number]> = DEFAULT_LLM_SLUGS
): NonEmpty<(typeof LLM_SLUGS)[number]> {
  const models: (typeof LLM_SLUGS)[number][] = [...options.models];
  const want = cleanSplit(attms, ",")
    .filter((m) => (LLM_SLUGS as readonly string[]).includes(m))
    .reverse();
  for (const w of want) models.unshift(w as (typeof LLM_SLUGS)[number]);
  const out = (models.length > 0 ? models : [...defaultModels]) as NonEmpty<
    (typeof LLM_SLUGS)[number]
  >;
  return out;
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

export function userVoicesAndPresetVoices(userVoices: VoiceSpec[]) {
  return [...userVoices, ...ELEVENLABS_PRESET_VOICES];
}

export function setState(
  state: Record<string, TSerial>,
  key: string,
  value: TSerial
): void {
  set(state, key, value);
}
