import { NonEmpty } from "typings";
import z from "zod";

export type StoryCartridge = Record<string, Buffer | string>;

export const StoryVoiceSchema = z.object({
  name: z.string(),
  ref: z.string(),
  id: z.string(),
  tags: z.array(z.string()),
});

export type VoiceSpec = z.infer<typeof StoryVoiceSchema>;

export type StorySource = {
  voices: VoiceSpec[];
  root: StoryNode;
  meta: Record<string, string>;
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

export const StoryCheckpointSchema = z.object({
  createdAt: z.number(),
  addr: z.string().nullable(),
  turn: z.number(),
  cycle: z.number(),
  time: z.number(),
  state: z.record(z.any()),
  meta: z.record(z.any()),
  stack: z.array(
    z.object({
      returnAddress: z.string(),
      scope: z.record(z.any()),
      blockType: z.enum(["scope", "yield", "intro", "resume"]).optional(),
    })
  ),
  events: z.array(StoryEventSchema),
});

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
      body: z.string().nullable(),
      atts: z.record(z.any()),
      addr: z.string().optional(),
      retries: z.number().optional(),
      returnTo: z.string().optional(),
    }),
    z.null(),
  ]),
  stack: z.array(
    z.object({
      returnAddress: z.string(),
      scope: z.record(z.any()),
      blockType: z.enum(["scope", "yield", "intro", "resume"]).optional(),
    })
  ),
  state: z.record(z.any()),
  checkpoints: z.array(StoryCheckpointSchema),
  meta: z.record(z.any()),
  cache: z.record(z.any()),
  flowTarget: z.string().nullable().optional(),
  genie: z.record(z.union([z.instanceof(Buffer), z.string()])).optional(),
});

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

export const LLMSlugSchema = z.enum(LLM_SLUGS);

export const StoryOptionsSchema = z.object({
  verbose: z.boolean(),
  seed: z.string(),
  loop: z.number(),
  ream: z.number(),
  doGenerateSpeech: z.boolean(),
  doGenerateAudio: z.boolean(),
  maxCheckpoints: z.number().default(20),
  models: z
    .tuple([LLMSlugSchema, LLMSlugSchema])
    .rest(LLMSlugSchema)
    .transform((val) => val as NonEmpty<(typeof LLM_SLUGS)[number]>),
});

export type StoryEvent = z.infer<typeof StoryEventSchema>;
export type StoryCheckpoint = z.infer<typeof StoryCheckpointSchema>;
export type StorySession = z.infer<typeof StorySessionSchema>;
export type StoryOptions = z.infer<typeof StoryOptionsSchema>;
