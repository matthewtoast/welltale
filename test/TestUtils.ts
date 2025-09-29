import { isDeepStrictEqual } from "util";
import { advanceToNextUntilBlocking } from "../lib/StoryRunnerCoreBlocking";
import { RunnerOptions } from "./../lib/LocalRunnerUtils";
import { PRNG } from "./../lib/RandHelpers";
import { compileStory } from "./../lib/StoryCompiler";
import { MockStoryServiceProvider } from "./../lib/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  OP,
  SeamType,
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
    const result = await advanceToNextUntilBlocking(
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

  const baseContext: BaseActionContext = {
    session: createDefaultSession("compile-test"),
    rng: new PRNG("test-seed", 0),
    provider,
    scope: {},
    options,
    evaluator: async () => null,
  };

  const sources = await compileStory(baseContext, cartridge, {
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
}
