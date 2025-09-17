import { isDeepStrictEqual } from "util";
import { PRNG } from "lib/RandHelpers";
import { compileStory } from "lib/StoryCompiler";
import { MockStoryServiceProvider } from "lib/StoryServiceProvider";
import { createDefaultSession, SeamType, OP } from "lib/StoryEngine";
import { runUntilComplete, RunnerOptions } from "lib/LocalRunnerUtils";
import { DEFAULT_LLM_SLUGS, StorySession } from "lib/StoryTypes";

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

export async function runTestStory(
  xml: string | Record<string, string>,
  inputs: string[] = [],
  opt?: Partial<RunnerOptions>,
  sessionOpt?: {
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
    models: DEFAULT_LLM_SLUGS,
    doGenerateSpeech: false,
    doGenerateAudio: false,
    doPlayMedia: false,
    ...opt,
  };
  const rng = new PRNG(options.seed);
  const sources = await compileStory(
    { rng, provider, scope: {}, options },
    cartridge,
    { doCompileVoices: false }
  );
  const session = createDefaultSession(`test-session-${Date.now()}`);
  if (sessionOpt) {
    if (sessionOpt.resume !== undefined) session.resume = sessionOpt.resume;
    if (sessionOpt.turn !== undefined) session.turn = sessionOpt.turn;
    if (sessionOpt.address !== undefined) session.address = sessionOpt.address;
  }
  const ops: OP[] = [];
  const seam = await runUntilComplete(
    {
      options,
      provider,
      session,
      sources,
      seed: options.seed,
      inputs,
    },
    SeamType.GRANT,
    async (resp) => {
      ops.push(...resp.ops);
    }
  );
  return { ops, seam, session };
}
