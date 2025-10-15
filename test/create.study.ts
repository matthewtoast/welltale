import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dedent from "dedent";
import OpenAI from "openai";
import { join } from "path";
import { loadSstEnv } from "../env/env-sst";
import { LocalCache } from "../lib/LocalCache";
import { DefaultStoryServiceProvider } from "../lib/StoryDefaultServiceProvider";
import { LocalStoryRunnerOptions } from "../lib/StoryLocalRunnerUtils";
import { DEFAULT_LLM_SLUGS } from "../lib/StoryTypes";
import { createWelltaleContent } from "../lib/WelltaleKnowledgeContext";

const ROOT_DIR = join(__dirname, "..");

const env = loadSstEnv();

async function testTestStory() {
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
    { ...options, useWebSearch: false }
  );
  console.log(content);
}

testTestStory().catch(console.error);
