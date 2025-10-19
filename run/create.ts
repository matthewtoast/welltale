import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadSstEnv } from "../env/env-sst";
import { DefaultStoryServiceProvider } from "../lib/StoryDefaultServiceProvider";
import { DEFAULT_LLM_SLUGS } from "../lib/StoryTypes";
import { createWelltaleContent } from "../lib/WelltaleKnowledgeContext";
import { DEFAULT_CACHE_DIR, LocalCache } from "./../lib/LocalCache";

const env = loadSstEnv();

async function runCreate() {
  const argv = await yargs(hideBin(process.argv))
    .option("slug", {
      type: "string",
      description: "Slug for story",
      demandOption: true,
    })
    .option("idea", {
      type: "string",
      description: "Story concept",
      demandOption: true,
    })
    .option("openRouterApiKey", {
      type: "string",
      description: "OpenRouter API key",
      default: env.OPENROUTER_API_KEY,
    })
    .option("openRouterBaseUrl", {
      type: "string",
      description: "OpenRouter base URL",
      default: env.OPENROUTER_BASE_URL,
    })
    .option("elevenlabsKey", {
      type: "string",
      description: "ElevenLabs API key",
      default: env.ELEVENLABS_API_KEY,
    })
    .option("cacheDir", {
      type: "string",
      default: DEFAULT_CACHE_DIR,
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  const provider = new DefaultStoryServiceProvider(
    {
      eleven: new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY }),
      openai: new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: env.OPENROUTER_BASE_URL,
      }),
      cache: new LocalCache(argv.cacheDir),
    },
    {
      disableCache: false,
      verbose: true,
    }
  );
  const content = await createWelltaleContent(argv.idea, provider, {
    useWebSearch: false,
    models: DEFAULT_LLM_SLUGS,
  });
}

runCreate();
