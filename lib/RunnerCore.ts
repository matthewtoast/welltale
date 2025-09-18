import { advanceStory, OP, PLAYER_ID, SeamType } from "./StoryEngine";
import { StoryServiceProvider } from "./StoryServiceProvider";
import { StoryOptions, StorySession, StorySource } from "./StoryTypes";

export type RenderResult = {
  seam: SeamType;
  ops: OP[];
  addr: string | null;
  info: Record<string, string>;
};

export async function renderNext(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: StoryOptions,
  provider: StoryServiceProvider
): Promise<RenderResult> {
  if (input !== null) {
    if (!session.input) {
      session.input = { atts: {}, body: input, from: PLAYER_ID };
    } else {
      session.input.body = input;
    }
  }
  const { ops, seam, info, addr } = await advanceStory(
    provider,
    sources,
    session,
    options
  );
  return { seam, ops, addr, info };
}

export async function renderUntilBlocking(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: StoryOptions,
  provider: StoryServiceProvider
): Promise<RenderResult> {
  const collected: OP[] = [];
  let current = await renderNext(input, session, sources, options, provider);
  collected.push(...current.ops);
  
  while (current.seam === SeamType.MEDIA || current.seam === SeamType.GRANT) {
    current = await renderNext(null, session, sources, options, provider);
    collected.push(...current.ops);
  }
  
  return { ...current, ops: collected };
}
