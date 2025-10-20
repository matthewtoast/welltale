import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";
import { loadSstEnv } from "../env/env-sst";
import { DEFAULT_CACHE_DIR, LocalCache } from "./LocalCache";
import { DefaultStoryServiceProvider } from "./StoryDefaultServiceProvider";
const env = loadSstEnv();
export function createProvider() {
  const provider = new DefaultStoryServiceProvider(
    {
      eleven: new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY }),
      openai: new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: env.OPENROUTER_BASE_URL,
      }),
      cache: new LocalCache(DEFAULT_CACHE_DIR),
    },
    {
      disableCache: false,
      verbose: true,
    }
  );
  return provider;
}
