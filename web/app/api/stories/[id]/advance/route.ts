import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { loadAppEnv } from "../../../../../../env/env-app";
import { safeJsonParseTyped } from "./../../../../../../lib/JSONHelpers";
import { advanceStory } from "./../../../../../../lib/StoryEngine";
import { createStoryRepo } from "./../../../../../../lib/StoryRepo";
import { MockStoryServiceProvider } from "./../../../../../../lib/StoryServiceProvider";
import {
  StoryOptions,
  StorySession,
  StorySource,
} from "./../../../../../../lib/StoryTypes";
import { authenticateRequest } from "./../../../../../../lib/api/auth";

export const runtime = "nodejs";

const env = loadAppEnv();
const storyRepo = createStoryRepo({
  ddb: new DynamoDBClient({}),
  tableName: env.STORIES_TABLE,
  s3: new S3Client({}),
  bucketName: env.STORIES_BUCKET,
});

type Body = {
  session: StorySession;
  options: StoryOptions;
};

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const id = ctx.params.id;
  const comp = await storyRepo.getCompiled(id);
  if (!comp) return NextResponse.json({ ok: false }, { status: 404 });
  const t = await req.text();
  const b = safeJsonParseTyped<Body>(t);
  if (!b) return NextResponse.json({ ok: false }, { status: 400 });
  const provider = new MockStoryServiceProvider();
  const src = comp as StorySource;
  const { ops, session, seam, info } = await advanceStory(
    provider,
    src,
    b.session,
    b.options
  );
  return NextResponse.json({ ops, session, seam, info }, { status: 200 });
}
