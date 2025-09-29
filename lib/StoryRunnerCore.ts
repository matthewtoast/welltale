import { advanceStory } from "./StoryEngine";
import { StoryServiceProvider } from "./StoryServiceProvider";
import { createStoryStream } from "./StoryStream";
import {
  StoryAdvanceResult,
  StoryOptions,
  StorySession,
  StorySource,
  OP,
  PLAYER_ID,
  SeamType,
} from "./StoryTypes";

export async function advanceToNext(
  input: string | null,
  session: StorySession,
  sources: StorySource,
  options: StoryOptions,
  provider: StoryServiceProvider
): Promise<StoryAdvanceResult> {
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

export async function runWithPrefetch(
  input: string | null,
  advance: (input: string | null) => Promise<StoryAdvanceResult>,
  render: (ops: OP[]) => Promise<void>
): Promise<StoryAdvanceResult> {
  const stream = createStoryStream(advance);
  stream.push(input);
  const ops: OP[] = [];
  let last: StoryAdvanceResult | null = null;
  while (true) {
    const next = await stream.take();
    if (!next) {
      break;
    }
    if (next.ops.length > 0) {
      ops.push(...next.ops);
      await render(next.ops);
    }
    last = next;
    if (next.seam === SeamType.MEDIA || next.seam === SeamType.GRANT) {
      continue;
    }
    if (next.seam === SeamType.ERROR) {
      logError(next.info);
    }
    break;
  }
  stream.close();
  return { ...last!, ops };
}

export async function runUntilComplete(
  inputs: string[],
  seam: SeamType = SeamType.GRANT,
  advance: (input: string | null) => Promise<StoryAdvanceResult>,
  render: (ops: OP[]) => Promise<void>,
  renderInput: (input: string | null) => Promise<void>
): Promise<{ seam: SeamType }> {
  let next = seam;
  while (true) {
    if (next === SeamType.ERROR || next === SeamType.FINISH) {
      return { seam: next };
    }
    const input = next === SeamType.INPUT ? (inputs.shift() ?? "") : null;
    if (next === SeamType.INPUT) {
      await renderInput(input);
    }
    const result = await runWithPrefetch(input, advance, render);
    next = result.seam;
  }
}

function logError(info: Record<string, string>) {
  const msg =
    (info.reason && typeof info.reason === "string" && info.reason) ||
    (info.error && typeof info.error === "string" && info.error) ||
    "Unknown error";
  console.error(msg);
}
