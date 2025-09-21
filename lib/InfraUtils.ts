import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { OpenAI } from "openai";
import { Readable } from "stream";
import { loadAppEnv } from "./../env/env-app";
import { toBuffer, unzip } from "./BufferUtils";
import { S3Cache } from "./S3Cache";
import { compileStory } from "./StoryCompiler";
import { createStoryRepo, uploadKey } from "./StoryRepo";
import { DefaultStoryServiceProvider } from "./StoryServiceProvider";
import { StoryCartridge } from "./StoryTypes";

const env = loadAppEnv();
const sharedS3 = new S3Client({});
const sharedDdb = new DynamoDBClient({});
const storyRepo = createStoryRepo({
  ddb: sharedDdb,
  tableName: env.STORIES_TABLE,
  s3: sharedS3,
  bucketName: env.STORIES_BUCKET,
});

export async function compileStoryJob(storyId: string) {
  const key = uploadKey(storyId);
  const obj = await sharedS3.send(
    new GetObjectCommand({ Bucket: env.STORIES_BUCKET, Key: key })
  );

  const zip = await toBuffer(obj.Body as Readable);
  const files = await unzip(zip);
  const cartridge: StoryCartridge = {};
  for (const k of Object.keys(files)) cartridge[k] = files[k];

  const provider = new DefaultStoryServiceProvider(
    {
      openai: new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: env.OPENROUTER_BASE_URL,
      }),
      eleven: new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY }),
      cache: new S3Cache(sharedS3, env.CACHE_BUCKET),
    },
    {
      disableCache: false,
      verbose: true,
    }
  );

  const compiled = await compileStory(provider, cartridge, {
    doCompileVoices: true,
  });

  await storyRepo.putCompiled(storyId, compiled);

  const meta = await storyRepo.getMeta(storyId);
  if (meta) {
    meta.compile = "ready";
    meta.updatedAt = Date.now();
    await storyRepo.putMeta(meta);
  }
}
