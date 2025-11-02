import { assignInput } from "./StoryConstants";
import { advanceStory } from "./StoryEngine";
import { StoryServiceProvider } from "./StoryServiceProvider";
import { StoryAdvanceResult, StoryOptions, StorySession } from "./StoryTypes";

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
