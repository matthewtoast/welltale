import { isDeepStrictEqual } from "util";
import { compileStory } from "../lib/engine/StoryCompiler";
import { LocalStoryRunnerOptions } from "../lib/engine/StoryLocalRunnerUtils";
import { advanceToNextUntilBlocking } from "../lib/engine/StoryRunnerCoreBlocking";
import {
  CompilerContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  OP,
  SeamType,
  StorySession,
  StorySource,
} from "../lib/engine/StoryTypes";
import {
  MockStoryServiceProvider,
  StoryServiceProvider,
} from "./../lib/engine/StoryServiceProvider";
import { PRNG } from "./../lib/RandHelpers";

export function expect(a: unknown, b: unknown, doThrow: boolean = true) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  const msg = `${ja} === ${jb}`;
  if (isDeepStrictEqual(a, b)) {
    console.info("✅", msg);
  } else {
    if (doThrow) {
      throw new Error(`❌ ${ja} isn't equal to ${jb}`);
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
    verbose: true,
    ream: 100,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    models: DEFAULT_LLM_SLUGS,
    doGenerateAudio: false,
    doGenerateImage: false,
    doPlayMedia: false,
  };
  const rng = new PRNG("test-seed", 0);
  const compilerContext: CompilerContext = {
    rng,
    provider,
    scope: {},
    options: { models: options.models },
    evaluator: async () => null,
    ddv: { cycles: {}, bags: {} },
  };
  const sources = await compileStory(compilerContext, cartridge, {
    doCompileVoices: false,
    doGenerateThumbnails: true,
  });
  const session = createDefaultSession("test", sources);
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
