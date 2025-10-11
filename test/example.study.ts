import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dedent from "dedent";
import OpenAI from "openai";
import { join } from "path";
import { loadSstEnv } from "../env/env-sst";
import { buildDefaultFuncs } from "../lib/EvalMethods";
import { loadDirRecursive } from "../lib/FileUtils";
import { LocalCache } from "../lib/LocalCache";
import { createRunner, evaluateScript } from "../lib/QuickJSUtils";
import { PRNG } from "../lib/RandHelpers";
import { compileStory } from "../lib/StoryCompiler";
import { DefaultStoryServiceProvider } from "../lib/StoryDefaultServiceProvider";
import { LocalStoryRunnerOptions } from "../lib/StoryLocalRunnerUtils";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
} from "../lib/StoryTypes";
import { createWelltaleContent } from "../lib/WelltaleKnowledgeContext";
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
  const session = createDefaultSession(options.seed);
  const rng = new PRNG(options.seed, 0);
  const funcs = buildDefaultFuncs({}, rng);
  const runner = await createRunner();
  const context: BaseActionContext = {
    session,
    rng,
    provider,
    scope: {},
    options,
    evaluator: async (expr, scope) => {
      return await evaluateScript(expr, scope, funcs, runner);
    },
  };
  const content = await createWelltaleContent(
    dedent`
      This is a humorous story where the player takes on the role of a juror during voir dire.

      The player's objective is to avoid getting selected for the jury.

      The laywer doing the interviewing (an NPC), however, is desperate to get the player on the jury.

      The judge (an NPC) occasionally interjects to keep things "on track." Once the judge's threshold for absurdity is breached, they reject the juror (the player) and the player wins.

      The judge should take on the role of the "straight man" and host of sorts, introing the scene (in character), and giving the player cues as necessary. But 90% should be dialog between the player and lawyer.

      As the story progresses the lawyer should resort to ever more absurd and humorous ways to deal with the juror's attempts to disqualify himself.
    `,
    provider,
    options
  );
  console.log(content);
  return;
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
