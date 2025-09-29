import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { OpenAI } from "openai";
import { Readable } from "stream";
import { loadAppEnv } from "./../env/env-app";
import { toBuffer, unzip } from "./BufferUtils";
import { buildDefaultFuncs } from "./EvalMethods";
import { createRunner, evaluateScript } from "./QuickJSUtils";
import { PRNG } from "./RandHelpers";
import { S3Cache } from "./S3Cache";
import { compileStory } from "./StoryCompiler";
import { createStoryRepo, uploadKey } from "./StoryRepo";
import { DefaultStoryServiceProvider } from "./DefaultStoryServiceProvider";
import {
  BaseActionContext,
  DEFAULT_LLM_SLUGS,
  EvaluatorFunc,
  StoryCartridge,
  StoryOptions,
  createDefaultSession,
} from "./StoryTypes";

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

  const options: StoryOptions = {
    seed: "compile",
    verbose: true,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateSpeech: false,
    doGenerateAudio: false,
    models: DEFAULT_LLM_SLUGS,
  };

  const rng = new PRNG("compile");
  const scriptRunner = await createRunner();
  const funcs = buildDefaultFuncs({}, rng);
  const evaluator: EvaluatorFunc = async (expr, scope) => {
    return await evaluateScript(expr, scope, funcs, scriptRunner);
  };

  const baseContext: BaseActionContext = {
    session: createDefaultSession(storyId),
    rng: new PRNG("compile", 0),
    provider,
    scope: {},
    options,
    evaluator,
  };

  const compiled = await compileStory(baseContext, cartridge, {
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
