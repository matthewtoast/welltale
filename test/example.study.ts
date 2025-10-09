import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";
import { join } from "path";
import { loadSstEnv } from "../env/env-sst";
import { loadDirRecursive } from "../lib/FileUtils";
import { LocalCache } from "../lib/LocalCache";
import { PRNG } from "../lib/RandHelpers";
import { compileStory } from "../lib/StoryCompiler";
import { DefaultStoryServiceProvider } from "../lib/StoryDefaultServiceProvider";
import { LocalStoryRunnerOptions } from "../lib/StoryLocalRunnerUtils";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
} from "../lib/StoryTypes";
import { runUntilComplete } from "./TestUtils";

const ROOT_DIR = join(__dirname, "..");

const env = loadSstEnv();

async function testTestStory() {
  const cartridge = await loadDirRecursive(join(ROOT_DIR, "fic/example"));
  const options: LocalStoryRunnerOptions = {
    seed: "example-story",
    verbose: false,
    ream: 100,
    loop: 0,
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
  const session = createDefaultSession("example-story");
  const context: BaseActionContext = {
    session,
    rng: new PRNG("example-story", 0),
    provider,
    scope: {},
    options,
    evaluator: async () => null,
  };
  const sources = await compileStory(context, cartridge, {
    doCompileVoices: false,
  });
  const result = await runUntilComplete({
    options,
    provider,
    sources,
    session,
    inputs: [],
  });
  console.log(result.ops);
}

testTestStory().catch(console.error);
