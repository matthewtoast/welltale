import { assignInput } from "./StoryConstants";
import { advanceStory } from "./StoryEngine";
import { StoryServiceProvider } from "./StoryServiceProvider";
import {
  OP,
  SeamType,
  StoryAdvanceResult,
  StoryOptions,
  StorySession,
  StorySource,
} from "./StoryTypes";

export async function advanceToNext(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: StoryOptions,
  provider: StoryServiceProvider
): Promise<StoryAdvanceResult> {
  assignInput(session, input);
  const { ops, seam, info, addr } = await advanceStory(
    provider,
    sources,
    session,
    options
  );
  return { seam, ops, addr, info, session };
}

export async function advanceToNextUntilBlocking(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: StoryOptions,
  provider: StoryServiceProvider
): Promise<StoryAdvanceResult> {
  const collected: OP[] = [];
  let current = await advanceToNext(input, session, sources, options, provider);
  collected.push(...current.ops);
  while (current.seam === SeamType.MEDIA || current.seam === SeamType.GRANT) {
    current = await advanceToNext(null, session, sources, options, provider);
    collected.push(...current.ops);
  }
  return { ...current, ops: collected };
}
