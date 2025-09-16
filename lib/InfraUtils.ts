import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { OpenAI } from "openai";
import { Readable } from "stream";
import { toBuffer, unzip } from "./BufferUtils";
import { PRNG } from "./RandHelpers";
import { S3Cache } from "./S3Cache";
import { compileStory } from "./StoryCompiler";
import { getMeta, putCompiled, putMeta, uploadKey } from "./StoryRepo";
import { DefaultStoryServiceProvider } from "./StoryServiceProvider";
import { DEFAULT_LLM_SLUGS, StoryCartridge } from "./StoryTypes";

const STORIES_BUCKET = process.env.STORIES_BUCKET!;
const CACHE_BUCKET = process.env.CACHE_BUCKET!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

if (!STORIES_BUCKET) {
  throw new Error("STORIES_BUCKET env var missing");
}
if (!CACHE_BUCKET) {
  throw new Error("CACHE_BUCKET env var missing");
}
if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY env var missing");
}
if (!ELEVENLABS_API_KEY) {
  throw new Error("ELEVENLABS_API_KEY env var missing");
}

export async function compileStoryJob(storyId: string) {
  const s3Client = new S3Client({});
  const key = uploadKey(storyId);
  const obj = await s3Client.send(
    new GetObjectCommand({ Bucket: STORIES_BUCKET, Key: key })
  );

  const zip = await toBuffer(obj.Body as Readable);
  const files = await unzip(zip);
  const cartridge: StoryCartridge = {};
  for (const k of Object.keys(files)) cartridge[k] = files[k];

  const provider = new DefaultStoryServiceProvider(
    {
      openai: new OpenAI({
        apiKey: OPENROUTER_API_KEY,
        baseURL: OPENROUTER_BASE_URL,
      }),
      eleven: new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY }),
      cache: new S3Cache(s3Client, CACHE_BUCKET),
    },
    {
      disableCache: false,
      verbose: true,
    }
  );

  const options = {
    verbose: false,
    seed: "seed",
    loop: 0,
    ream: 100,
    doGenerateSpeech: true,
    doGenerateAudio: true,
    maxCheckpoints: 20,
    models: DEFAULT_LLM_SLUGS,
  };

  const rng = new PRNG(options.seed);
  const ctx = { rng, provider, scope: {}, options };

  const compiled = await compileStory(ctx, cartridge, {
    doCompileVoices: true,
  });

  await putCompiled(storyId, compiled);

  const meta = await getMeta(storyId);
  if (meta) {
    meta.compile = "ready";
    meta.updatedAt = Date.now();
    await putMeta(meta);
  }
}
