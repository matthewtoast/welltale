import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";
import { join } from "path";
import { loadSstEnv } from "../../env/env-sst";
import { compileStory } from "../../lib/engine/StoryCompiler";
import { DefaultStoryServiceProvider } from "../../lib/engine/StoryDefaultServiceProvider";
import { LocalStoryRunnerOptions } from "../../lib/engine/StoryLocalRunnerUtils";
import {
  CompilerContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
} from "../../lib/engine/StoryTypes";
import { buildDefaultFuncs } from "../../lib/EvalMethods";
import { loadDirRecursive } from "../../lib/FileUtils";
import { LocalCache } from "../../lib/LocalCache";
import { createRunner, evaluateScript } from "../../lib/QuickJSUtils";
import { PRNG } from "../../lib/RandHelpers";
import { runUntilComplete } from "../TestUtils";

const ROOT_DIR = join(__dirname, "..");

const env = loadSstEnv();

async function testTestStory() {
  const cartridge = await loadDirRecursive(join(ROOT_DIR, "fic/example"));

  const options: LocalStoryRunnerOptions = {
    seed: "example-story",
    verbose: false,
    ream: 100,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    models: DEFAULT_LLM_SLUGS,
    doGenerateAudio: false,
    doGenerateImage: false,
    doPlayMedia: false,
  };

  const provider = new DefaultStoryServiceProvider(
    {
      eleven: new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY }),
      openai: new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: env.OPENROUTER_BASE_URL,
      }),
      cache: new LocalCache(join(ROOT_DIR, "tmp")),
    },
    {
      disableCache: false,
      verbose: true,
    }
  );
  const rng = new PRNG(options.seed, 0);
  const funcs = buildDefaultFuncs({}, rng);
  const runner = await createRunner();
  const compilerContext: CompilerContext = {
    rng,
    provider,
    locals: {},
    options: { models: options.models },
    evaluator: async (expr, scope) => {
      return await evaluateScript(expr, scope, funcs, runner);
    },
    ddv: { cycles: {}, bags: {} },
  };
  const sources = await compileStory(compilerContext, cartridge, {
    doCompileVoices: false,
    doGenerateThumbnails: true,
  });
  const inputSets: string[][] = [
    ["Let's go into the forest.", "I blurt out that the answer is the moon."],
    [
      "I choose the forest path.",
      "Is the answer one of the seasons like spring summer autumn or winter?",
      "Buy the sword please.",
      "I'm done shopping, time to leave.",
      "Take my sword as payment; it's enchanted and worth more than your toll so let me cross.",
    ],
    [
      "I'll head toward the swamp.",
      "orange",
      "I'd like to buy a potion.",
      "That's it, I'm leaving now.",
      "Accept this potion as payment; it heals any wound so let me cross your bridge.",
    ],
    [
      "I'll go through the swamp instead.",
      "river",
      "castle",
      "orange",
      "I'm finished shopping, let me leave.",
      "I don't really have anything valuable.",
      "Fine take 20 gold coins; they're dwarven mint and worth your toll so please let me pass.",
    ],
  ];
  for (let i = 0; i < inputSets.length; i++) {
    const session = createDefaultSession(`${options.seed}-${i}`, sources);
    console.log(`\n--- Run ${i + 1} ---`);
    const result = await runUntilComplete({
      options,
      provider,
      sources,
      session,
      inputs: inputSets[i],
    });
    result.ops.forEach((op) => {
      if (op.type === "play-media") {
        if (op.event) {
          console.log(op.event.from, op.event.body);
        }
      }
    });
  }
}

testTestStory().catch(console.error);
