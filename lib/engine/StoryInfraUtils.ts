import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { OpenAI } from "openai";
import { Readable } from "stream";
import { loadAppEnv } from "../../env/env-app";
import { NonEmpty } from "../../typings";
import { toBuffer, unzip } from "../BufferUtils";
import { buildDefaultFuncs } from "../EvalMethods";
import { createRunner, evaluateScript } from "../QuickJSUtils";
import { PRNG } from "../RandHelpers";
import { S3Cache } from "../S3Cache";
import { compileStory } from "./StoryCompiler";
import { DefaultStoryServiceProvider } from "./StoryDefaultServiceProvider";
import { createStoryRepo, uploadKey } from "./StoryRepo";
import {
  CompilerContext,
  EvaluatorFunc,
  LLM_SLUGS,
  StoryCartridge,
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

export type CompileStoryJobOptions = {
  diableCache: boolean;
  verbose: boolean;
  seed: string;
  models: NonEmpty<(typeof LLM_SLUGS)[number]>;
  doCompileVoices: boolean;
  doGenerateThumbnails: boolean;
};
export async function compileStoryJob(
  storyId: string,
  options: CompileStoryJobOptions
) {
  console.info(`[compile] Start ${storyId}`);
  const key = uploadKey(storyId);

  console.info(`[compile] Fetch ${storyId} key:${key}`);
  const obj = await sharedS3.send(
    new GetObjectCommand({ Bucket: env.STORIES_BUCKET, Key: key })
  );

  console.info(`[compile] Zip ${storyId}`);
  const zip = await toBuffer(obj.Body as Readable);
  const files = await unzip(zip);

  console.info(`[compile] Files ${storyId} count:${Object.keys(files).length}`);
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
      disableCache: options.diableCache,
      verbose: options.verbose,
    }
  );

  const rng = new PRNG(options.seed);
  const scriptRunner = await createRunner();
  const funcs = buildDefaultFuncs({}, rng);
  const evaluator: EvaluatorFunc = async (expr, scope) => {
    return await evaluateScript(expr, scope, funcs, scriptRunner);
  };

  const compilerContext: CompilerContext = {
    rng,
    provider,
    scope: {},
    options: { models: options.models },
    evaluator,
    ddv: { cycles: {}, bags: {} },
  };

  const compiled = await compileStory(compilerContext, cartridge, {
    doCompileVoices: options.doCompileVoices,
    doGenerateThumbnails: options.doGenerateThumbnails,
  });
  console.info(`[compile] Done ${storyId}`);

  await storyRepo.putCompiled(storyId, compiled);
  console.info(`[compile] Save ${storyId}`);

  const meta = await storyRepo.getMeta(storyId);
  console.info(`[compile] Meta`, meta);
  if (meta) {
    meta.compile = "ready";
    meta.updatedAt = Date.now();
    await storyRepo.putMeta(meta);
    return;
  }
}
