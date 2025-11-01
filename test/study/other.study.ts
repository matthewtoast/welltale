import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";
import { join } from "path";
import { loadSstEnv } from "../../env/env-sst";
import { DefaultStoryServiceProvider } from "../../lib/engine/StoryDefaultServiceProvider";
import { extractWithLLM } from "../../lib/engine/StoryInput";
import { LocalCache } from "../../lib/LocalCache";

const ROOT_DIR = join(__dirname, "..");
const env = loadSstEnv();

async function go() {
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
      disableCache: true,
      verbose: true,
    }
  );
  const e1 = await extractWithLLM(
    "はい",
    {
      "answer.type": "boolean",
      "answer.description":
        "true if the user said 'yes', 'let's go', 'why not', 'はい', 'one more time' (etc)  or amything in the affirmative; false if not",
    },
    provider,
    {
      models: [
        "openai/gpt-5-mini",
        "openai/gpt-5-nano",
        "openai/gpt-4.1-mini",
        "openai/gpt-4.1-nano",
      ],
    }
  );
}
go();
