import assert from "assert/strict";
import { loadEnv } from "lib/DotEnv";
import { loadDirRecursive } from "lib/FileUtils";
import { PRNG } from "lib/RandHelpers";
import { compileStory, CompileOptions } from "lib/StoryCompiler";
import { MockStoryServiceProvider } from "lib/StoryServiceProvider";
import { DEFAULT_LLM_SLUGS } from "lib/StoryTypes";
import {
  createDefaultSession,
  OP,
  SeamType,
} from "lib/StoryEngine";
import {
  runUntilComplete,
  RunnerOptions,
} from "lib/LocalRunnerUtils";
import { join } from "path";

loadEnv();

async function main() {
  const cartridgeDir = join(
    __dirname,
    "fixtures",
    "cartridges",
    "test-outro"
  );
  const cartridge = await loadDirRecursive(cartridgeDir);
  const provider = new MockStoryServiceProvider();
  const runnerOptions: RunnerOptions = {
    seed: "seed",
    verbose: false,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    models: DEFAULT_LLM_SLUGS,
    doGenerateSpeech: false,
    doGenerateAudio: false,
    doPlayMedia: false,
  };
  const rng = new PRNG(runnerOptions.seed);
  const compileOptions: CompileOptions = { doCompileVoices: false };
  const sources = await compileStory(
    { rng, provider, scope: {}, options: runnerOptions },
    cartridge,
    compileOptions
  );
  const session = createDefaultSession("test-outro");
  const ops: OP[] = [];
  const seam = await runUntilComplete(
    {
      options: runnerOptions,
      provider,
      session,
      sources,
      seed: runnerOptions.seed,
      inputs: [],
    },
    SeamType.GRANT,
    async (resp) => {
      ops.push(...resp.ops);
    }
  );
  assert.equal(seam, SeamType.FINISH);
  const texts = ops
    .filter((op): op is Extract<OP, { type: "play-event" }> => op.type === "play-event")
    .map((op) => op.event.body);
  assert.deepEqual(texts, ["start", "middle", "end"]);
}

main();
