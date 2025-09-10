import z from "zod";

export type StoryCartridge = Record<string, Buffer | string>;

export const VoiceSchema = z.object({
  name: z.string(),
  ref: z.string(),
  id: z.string(),
  tags: z.array(z.string()),
});

export type VoiceSpec = z.infer<typeof VoiceSchema>;

export type StorySource = {
  voices: VoiceSpec[];
  root: StoryNode;
};

export type StoryNode = {
  addr: string; // a tree locator string like "0.2.1"
  type: string; // the tag name, e.g. p, block, #text, whatever
  atts: Record<string, string>; // the element attributes
  kids: StoryNode[]; // its children (can be empty array)
  text: string; // its text value (can be empty string)
};
