import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadAppEnv } from "../../../../../../env/env-app";
import { authenticateRequest } from "../../../../../lib/api/auth";
import { DefaultStoryServiceProvider } from "./../../../../../../lib/DefaultStoryServiceProvider";
import { safeJsonParseTyped } from "./../../../../../../lib/JSONHelpers";
import { S3Cache } from "./../../../../../../lib/S3Cache";
import { advanceStory } from "./../../../../../../lib/StoryEngine";
import { createStoryRepo } from "./../../../../../../lib/StoryRepo";
import { StoryOptions, StorySession } from "./../../../../../../lib/StoryTypes";

export const runtime = "nodejs";

const env = loadAppEnv();

const s3 = new S3Client({});

const storyRepo = createStoryRepo({
  ddb: new DynamoDBClient({}),
  tableName: env.STORIES_TABLE,
  s3,
  bucketName: env.STORIES_BUCKET,
});

const provider = new DefaultStoryServiceProvider(
  {
    eleven: new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY }),
    openai: new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
    }),
    cache: new S3Cache(s3, env.CACHE_BUCKET),
  },
  {
    disableCache: false,
    verbose: true,
  }
);

type Body = {
  session: StorySession;
  options: StoryOptions;
};

type StoryCtx = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: StoryCtx) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const source = await storyRepo.getCompiled(id);
  if (!source) return NextResponse.json({ ok: false }, { status: 404 });
  const t = await req.text();
  const b = safeJsonParseTyped<Body>(t);
  if (!b) return NextResponse.json({ ok: false }, { status: 400 });
  const { ops, session, seam, info, addr } = await advanceStory(
    provider,
    source,
    b.session,
    b.options
  );
  return NextResponse.json({ ops, session, seam, info, addr }, { status: 200 });
}
