import { NonEmpty, TSerial } from "../typings";
import { PRNG } from "./RandHelpers";
import { StoryServiceProvider } from "./StoryServiceProvider";
export { PLAYER_ID } from "./StoryConstants";

export type StoryCartridge = Record<string, Buffer | string>;

export type VoiceSpec = {
  name: string;
  ref: string;
  id: string;
  tags: string[];
};

export type NestedRecords = {
  [key: string]: string | NestedRecords;
};

export type StoryNode = {
  addr: string; // a tree locator string like "0.2.1"
  type: string; // the tag name, e.g. p, block, #text, whatever
  atts: Record<string, string>; // the element attributes
  kids: StoryNode[]; // its children (can be empty array)
  text: string; // its text value (can be empty string)
};

export type StoryEvent = {
  node: {
    type: string;
    addr: string;
    atts: Record<string, TSerial>;
  };
  from: string;
  to: string;
  obs: string[];
  body: string;
  tags: string[];
  time: number;
};

export type TSessionStackObj = {
  returnAddress: string;
  writeableScope: Record<string, TSerial> | null;
  readableScope: Record<string, TSerial> | null;
  blockType?: "scope" | "yield" | "intro" | "resume" | "outro";
};

export type StoryCheckpoint = {
  addr: string | null;
  turn: number;
  cycle: number;
  time: number;
  state: Record<string, TSerial>;
  meta: Record<string, TSerial>;
  outroed?: boolean;
  stack: TSessionStackObj[];
  events: StoryEvent[];
};

export type DDVState = {
  cycles: Record<string, number>;
  bags: Record<string, { order: number[]; idx: number }>;
};

export type StorySource = {
  root: StoryNode;
  voices: Record<string, VoiceSpec>;
  pronunciations: Record<string, string>;
  scripts: NestedRecords;
  meta: {
    [key: string]: TSerial;
  };
};

export type StorySession = {
  id: string;
  time: number;
  turn: number;
  cycle: number;
  loops: number;
  resume: boolean;
  address: string | null;
  input: {
    body: string | null;
    atts: Record<string, any>;
  } | null;
  player: {
    id: string;
  };
  outroed: boolean;
  stack: TSessionStackObj[];
  state: Record<string, any>;
  checkpoints: StoryCheckpoint[];
  meta: Record<string, any>;
  cache: Record<string, any>;
  target?: string | null;
  genie?: Record<string, Buffer | string>;
  ddv: DDVState;
};

export const LLM_SLUGS = [
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "openai/gpt-4o",
  "anthropic/claude-3.5-sonnet",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-v3.1",
  "mistralai/mistral-large",
  "meta-llama/llama-3.1-70b-instruct",
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
] as const;

export const LLM_MODEL_TAGS = ["mini", "uncensored"] as const;

export const LLM_SLUGS_TAGGED: Record<
  (typeof LLM_SLUGS)[number],
  (typeof LLM_MODEL_TAGS)[number][]
> = {
  "openai/gpt-5": [],
  "openai/gpt-5-mini": ["mini"],
  "openai/gpt-5-nano": ["mini"],
  "openai/gpt-4.1": [],
  "openai/gpt-4.1-mini": ["mini"],
  "openai/gpt-4.1-nano": ["mini"],
  "openai/gpt-4o": [],
  "anthropic/claude-3.5-sonnet": [],
  "deepseek/deepseek-r1": [],
  "deepseek/deepseek-v3.1": [],
  "mistralai/mistral-large": [],
  "meta-llama/llama-3.1-70b-instruct": [],
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free": [
    "uncensored",
  ],
  "meta-llama/llama-3.3-70b-instruct:free": ["uncensored"],
  "meta-llama/llama-3.2-3b-instruct:free": ["uncensored"],
};

export const DEFAULT_LLM_SLUGS: NonEmpty<(typeof LLM_SLUGS)[number]> = [
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
];

export type LLMSlug = (typeof LLM_SLUGS)[number];

export const IMAGE_MODEL_SLUGS = [
  "google/gemini-2.5-flash-image-preview",
  // Add more models here as they become available on OpenRouter
  // Potential future additions: black-forest-labs/flux-1-dev, etc.
] as const;

export const IMAGE_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type ImageModelSlug = (typeof IMAGE_MODEL_SLUGS)[number];
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];

export type StoryOptions = {
  verbose: boolean;
  seed: string;
  loop: number;
  ream: number;
  doGenerateAudio: boolean;
  doGenerateImage: boolean;
  maxCheckpoints: number;
  inputRetryMax: number;
  models: NonEmpty<LLMSlug>;
};

export type StoryBaseMeta = {
  title: string;
  author: string;
  description: string;
  tags: string[];
};

export type StoryMeta = {
  id: string;
  publish: "draft" | "published";
  compile: "pending" | "ready";
  createdAt: number;
  updatedAt: number;
} & StoryBaseMeta;

export type StoryAdvanceResult = {
  ops: OP[];
  session: StorySession;
  addr: string | null;
  seam: SeamType;
  info: Record<string, string>;
};

export function createDefaultSession(
  id: string,
  state: Record<string, TSerial> = {},
  meta: Record<string, TSerial> = {}
): StorySession {
  return {
    id,
    player: {
      id,
    },
    time: Date.now(),
    turn: 0,
    cycle: 0,
    loops: 0,
    resume: false,
    address: null,
    input: null,
    stack: [],
    state,
    meta,
    cache: {},
    target: null,
    checkpoints: [],
    outroed: false,
    ddv: {
      cycles: {},
      bags: {},
    },
  };
}

export type PlayMediaOptions = {
  media: string; // URL
  volume: number | null;
  fadeDurationMs: number | null; // Milliseconds
  fadeAtMs: number | null; // Milliseconds
  background: boolean | null;
};

export type OP =
  | { type: "sleep"; duration: number }
  | { type: "get-input"; atts: Record<string, TSerial> }
  | ({ type: "play-media"; event: StoryEvent | null } & PlayMediaOptions)
  | { type: "show-media"; media: string; event: StoryEvent | null }
  | { type: "story-error"; reason: string }
  | { type: "story-end" };

export enum SeamType {
  INPUT = "input", // Client is expected to send user input in next call
  MEDIA = "media", // Server produced media to render
  GRANT = "grant", // Client should call again to grant OK to next batch of work
  ERROR = "error", // Error was encountered, could not continue
  FINISH = "finish", // Story was completed
}

export type EvaluatorFunc = (
  expr: string,
  scope: Record<string, TSerial>
) => Promise<TSerial>;

export interface BaseActionContext {
  session: StorySession;
  rng: PRNG;
  provider: StoryServiceProvider;
  scope: { [key: string]: TSerial };
  options: StoryOptions;
  evaluator: EvaluatorFunc;
}

export interface ActionContext extends BaseActionContext {
  origin: StoryNode;
  node: StoryNode;
  source: StorySource;
}

export interface ActionResult {
  ops: OP[];
  next: { node: StoryNode } | null;
}

export interface ActionHandler {
  docs?: ActionHandlerDocs;
  syntax?: ActionHandlerSyntax;
  tags: string[]; // List of XML tag names that match this handler, e.g  "p" for <p>, etc.
  exec: (context: ActionContext) => Promise<ActionResult>; // How the engine handles this tag
}

export type ActionHandlerCategory =
  | "control_flow" // This tag is used for control flow
  | "ai" // This tag's inner text content is used as a promp
  | "http" // This tag makes an external HTTP call
  | "compile_time" // This tag is processed at compile time
  | "render" // This tag's inner text is rendered (i.e. played back to) the player
  | "descendable" // This is a container type tag that can include any other type tag
  | "media" // This tag is used to render media to the player
  | "dev" // This tag is used during authoring to help development of stories
  | "state"; // This tag results in the story state being written to

export interface ActionHandlerDocs {
  desc: string; // Markdown describing what the tag is for, etc
  ex: { code: string; note?: string }[]; // Usage examples
  cats: ActionHandlerCategory[]; // Categories docs filtering, e.g. "control-flow", "output", etc
}

export interface ActionHandlerSyntax {
  block?: boolean; // Whether this is a block tag or self-closing
  atts: Record<
    string,
    {
      type: "string" | "number" | "boolean";
      desc: string;
      default?: string;
      req?: boolean; // Required or not
    }
  >;
}
