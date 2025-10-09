import { isDeepStrictEqual } from "util";
import { LocalStoryRunnerOptions } from "../lib/StoryLocalRunnerUtils";
import { advanceToNextUntilBlocking } from "../lib/StoryRunnerCoreBlocking";
import { PRNG } from "./../lib/RandHelpers";
import { compileStory } from "./../lib/StoryCompiler";
import {
  MockStoryServiceProvider,
  StoryServiceProvider,
} from "./../lib/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  OP,
  SeamType,
  StorySession,
  StorySource,
} from "./../lib/StoryTypes";

export function expect(a: unknown, b: unknown, doThrow: boolean = true) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  const msg = `${ja} === ${jb}`;
  if (isDeepStrictEqual(a, b)) {
    console.info("✅", msg);
  } else {
    if (doThrow) {
      throw new Error(`${ja} isn't equal to ${jb}`);
    } else {
      console.error(`❌ ${ja} isn't equal to ${jb}`);
    }
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

export type TestOut = {
  seam: SeamType;
  ops: OP[];
};

export async function runUntilComplete(
  info: {
    options: LocalStoryRunnerOptions;
    provider: StoryServiceProvider;
    session: StorySession;
    sources: StorySource;
    inputs: string[];
  },
  out: TestOut = { seam: SeamType.GRANT, ops: [] }
): Promise<TestOut> {
  let next = out.seam;
  while (true) {
    if (next === SeamType.ERROR || next === SeamType.FINISH) {
      return { seam: next, ops: out.ops };
    }
    const input = next === SeamType.INPUT ? (info.inputs.shift() ?? "") : null;
    const result = await advanceToNextUntilBlocking(
      input,
      info.session,
      info.sources,
      info.options,
      info.provider
    );
    out.ops.push(...result.ops);
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
  const options: LocalStoryRunnerOptions = {
    seed: "test-seed",
    verbose: false,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    models: DEFAULT_LLM_SLUGS,
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
  const outcome = await runUntilComplete({
    options,
    provider,
    session,
    sources,
    inputs,
  });
  return { ...outcome, session };
}
