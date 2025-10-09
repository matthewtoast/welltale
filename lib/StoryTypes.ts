import z from "zod";
import { NonEmpty, TSerial } from "../typings";
import { PRNG } from "./RandHelpers";
import { StoryServiceProvider } from "./StoryServiceProvider";
export { PLAYER_ID } from "./StoryConstants";

export type StoryCartridge = Record<string, Buffer | string>;

export const StoryVoiceSchema = z.object({
  name: z.string(),
  ref: z.string(),
  id: z.string(),
  tags: z.array(z.string()),
});

export type VoiceSpec = z.infer<typeof StoryVoiceSchema>;

export type NestedRecords = {
  [key: string]: string | NestedRecords;
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

export type StoryNode = {
  addr: string; // a tree locator string like "0.2.1"
  type: string; // the tag name, e.g. p, block, #text, whatever
  atts: Record<string, string>; // the element attributes
  kids: StoryNode[]; // its children (can be empty array)
  text: string; // its text value (can be empty string)
};

const StoryEventSchema = z.object({
  time: z.number(),
  from: z.string(),
  to: z.array(z.string()),
  obs: z.array(z.string()),
  body: z.string(),
  tags: z.array(z.string()),
});

export const SessionStackObj = z.object({
  returnAddress: z.string(),
  writeableScope: z.record(z.any()).nullable(),
  readableScope: z.record(z.any()).nullable(),
  blockType: z.enum(["scope", "yield", "intro", "resume", "outro"]).optional(),
});

export const StoryCheckpointSchema = z.object({
  addr: z.string().nullable(),
  turn: z.number(),
  cycle: z.number(),
  time: z.number(),
  state: z.record(z.any()),
  meta: z.record(z.any()),
  outroDone: z.boolean().optional(),
  stack: z.array(SessionStackObj),
  events: z.array(StoryEventSchema),
});

export const DDVStateSchema = z.object({
  cycles: z.record(z.number()),
  bags: z.record(z.object({ order: z.array(z.number()), idx: z.number() })),
});

export type TSessionStackObj = z.infer<typeof SessionStackObj>;

export const StorySessionSchema = z.object({
  id: z.string(),
  time: z.number(),
  turn: z.number(),
  cycle: z.number(),
  loops: z.number(),
  resume: z.boolean(),
  address: z.string().nullable(),
  input: z.union([
    z.object({
      from: z.string(),
      body: z.string().nullable(),
      atts: z.record(z.any()),
    }),
    z.null(),
  ]),
  outroDone: z.boolean().default(false),
  stack: z.array(SessionStackObj),
  state: z.record(z.any()),
  checkpoints: z.array(StoryCheckpointSchema),
  meta: z.record(z.any()),
  cache: z.record(z.any()),
  flowTarget: z.string().nullable().optional(),
  genie: z.record(z.union([z.instanceof(Buffer), z.string()])).optional(),
  inputTries: z.record(z.number()).default({}),
  inputLast: z.string().nullable().default(null),
  ddv: DDVStateSchema,
});

export type DDVState = z.infer<typeof DDVStateSchema>;

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
] as const;

export const DEFAULT_LLM_SLUGS: NonEmpty<(typeof LLM_SLUGS)[number]> = [
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
];

export const LLMSlugSchema = z.enum(LLM_SLUGS);

export const StoryOptionsSchema = z.object({
  verbose: z.boolean(),
  seed: z.string(),
  loop: z.number(),
  ream: z.number(),
  doGenerateAudio: z.boolean(),
  maxCheckpoints: z.number().default(20),
  inputRetryMax: z.number().default(3),
  models: z
    .tuple([LLMSlugSchema, LLMSlugSchema])
    .rest(LLMSlugSchema)
    .transform((val) => val as NonEmpty<(typeof LLM_SLUGS)[number]>),
});

export type StoryEvent = z.infer<typeof StoryEventSchema>;
export type StoryCheckpoint = z.infer<typeof StoryCheckpointSchema>;
export type StorySession = z.infer<typeof StorySessionSchema>;
export type StoryOptions = z.infer<typeof StoryOptionsSchema>;

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
    flowTarget: null,
    checkpoints: [],
    outroDone: false,
    inputTries: {},
    inputLast: null,
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
  | { type: "get-input" }
  | ({ type: "play-media"; event: StoryEvent | null } & PlayMediaOptions)
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
  events: StoryEvent[];
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
