import { S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";
import { loadSstEnv } from "../../env/env-sst";
import { ELEVENLABS_PRESET_VOICES } from "../../lib/ElevenLabsVoices";
import { S3Cache } from "../../lib/S3Cache";
import { DefaultStoryServiceProvider } from "../../lib/engine/StoryDefaultServiceProvider";

const env = loadSstEnv();

const s3 = new S3Client({});

const provider = new DefaultStoryServiceProvider(
  {
    eleven: new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY }),
    openai: new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
    }),
    cache: new S3Cache(
      s3,
      "matthew-welltale-web-site-cachebucket664be8d7-rzytbvsxkzha"
    ),
  },
  {
    disableCache: false,
    verbose: true,
  }
);

async function go() {
  const result = await provider.generateSpeech(
    {
      body: "test" + Date.now(),
      voice: "host",
      speaker: "host",
      tags: [],
      pronunciations: {},
    },
    ELEVENLABS_PRESET_VOICES,
    {
      disableCache: false,
    }
  );
  console.log(result);
}

go();
