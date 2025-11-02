import { assignInput } from "./StoryConstants";
import { advanceStory } from "./StoryEngine";
import { StoryServiceProvider } from "./StoryServiceProvider";
import {
  OP,
  SeamType,
  StoryAdvanceResult,
  StoryOptions,
  StorySession,
} from "./StoryTypes";

export async function advanceToNext(
  input: string | null,
  session: StorySession,
  options: StoryOptions,
  provider: StoryServiceProvider
): Promise<StoryAdvanceResult> {
  assignInput(session, input);
  const { ops, seam, info, addr, cost } = await advanceStory(
    provider,
    session,
    options
  );
  return { seam, ops, addr, info, session, cost };
}

export async function advanceToNextUntilBlocking(
  input: string | null,
  session: StorySession,
  options: StoryOptions,
  provider: StoryServiceProvider
): Promise<StoryAdvanceResult> {
  const collected: OP[] = [];
  let current = await advanceToNext(input, session, options, provider);
  collected.push(...current.ops);
  while (current.seam === SeamType.MEDIA || current.seam === SeamType.GRANT) {
    current = await advanceToNext(null, session, options, provider);
    collected.push(...current.ops);
  }
  return {
    ...current,
    ops: collected,
  };
}
