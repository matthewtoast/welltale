import { isDeepStrictEqual } from "util";
import { RunnerOptions } from "./../lib/LocalRunnerUtils";
import { renderUntilBlocking } from "./../lib/RunnerCore";
import { compileStory } from "./../lib/StoryCompiler";
import { createDefaultSession, OP, SeamType } from "./../lib/StoryEngine";
import { MockStoryServiceProvider } from "./../lib/StoryServiceProvider";
import {
  DEFAULT_LLM_SLUGS,
  StorySession,
  StorySource,
} from "./../lib/StoryTypes";

export function expect(a: unknown, b: unknown) {
  const msg = `${JSON.stringify(a)} === ${JSON.stringify(b)}`;
  if (isDeepStrictEqual(a, b)) {
    console.info("✅", msg);
  } else {
    console.error("❌", msg);
  }
}

export type TestStoryResult = {
  ops: OP[];
  seam: SeamType;
  session: StorySession;
};

export function createTestCartridge(xml: string, file: string = "main.xml") {
  return { [file]: xml };
}

async function runTestUntilComplete(
  info: {
    options: RunnerOptions;
    provider: MockStoryServiceProvider;
    session: StorySession;
    sources: StorySource;
    seed: string;
    inputs: string[];
  },
  collectedOps: OP[],
  seam: SeamType = SeamType.GRANT
): Promise<{ seam: SeamType }> {
  let next = seam;
  const runOptions: RunnerOptions = { ...info.options, seed: info.seed };

  while (true) {
    if (next === SeamType.ERROR || next === SeamType.FINISH) {
      return { seam: next };
    }
    const input = next === SeamType.INPUT ? (info.inputs.shift() ?? "") : null;

    // Use renderUntilBlocking directly and collect ops from result
    const result = await renderUntilBlocking(
      input,
      info.session,
      info.sources,
      runOptions,
      info.provider
    );

    // Collect the ops without actually rendering them
    collectedOps.push(...result.ops);

    next = result.seam;
  }
}

export async function runTestStory(
  xml: string | Record<string, string>,
  inputs: string[] = [],
  testOptions?: {
    resume?: boolean;
    turn?: number;
    address?: string;
  }
): Promise<TestStoryResult> {
  const cartridge = typeof xml === "string" ? createTestCartridge(xml) : xml;
  const provider = new MockStoryServiceProvider();
  const options: RunnerOptions = {
    seed: "test-seed",
    verbose: false,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    models: DEFAULT_LLM_SLUGS,
    doGenerateSpeech: false,
    doGenerateAudio: false,
    doPlayMedia: false,
  };

  const sources = await compileStory(provider, cartridge, {
    doCompileVoices: false,
  });

  const session = createDefaultSession(`test-session-${Date.now()}`);
  if (testOptions) {
    if (testOptions.resume !== undefined) session.resume = testOptions.resume;
    if (testOptions.turn !== undefined) session.turn = testOptions.turn;
    if (testOptions.address !== undefined)
      session.address = testOptions.address;
  }

  // Collect ops during the run
  const collectedOps: OP[] = [];

  // Suppress console output for tests
  const originalLog = console.log;
  console.log = () => {};

  try {
    const outcome = await runTestUntilComplete(
      {
        options,
        provider,
        session,
        sources,
        seed: options.seed,
        inputs,
      },
      collectedOps,
      SeamType.GRANT
    );

    return { ops: collectedOps, seam: outcome.seam, session };
  } finally {
    console.log = originalLog;
  }
}
