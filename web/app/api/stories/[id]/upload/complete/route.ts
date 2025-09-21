import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { NextResponse } from "next/server";
import { loadAppEnv } from "../../../../../../../env/env-app";
import { createStoryRepo } from "./../../../../../../../lib/StoryRepo";
import { authenticateRequest } from "./../../../../../../../lib/api/auth";
const env = loadAppEnv();

export const runtime = "nodejs";

const storyRepo = createStoryRepo({
  ddb: new DynamoDBClient({}),
  tableName: env.STORIES_TABLE,
  s3: new S3Client({}),
  bucketName: env.STORIES_BUCKET,
});

type StoryCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: StoryCtx) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const q = env.JOBS_QUEUE_URL;
  if (!q) {
    console.warn("missing queue");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const meta = await storyRepo.getMeta(id);
  if (!meta) return NextResponse.json({ ok: false }, { status: 404 });
  meta.compile = "pending";
  meta.updatedAt = Date.now();
  await storyRepo.putMeta(meta);
  const c = new SQSClient({});
  const body = JSON.stringify({ type: "compile", id });
  await c.send(new SendMessageCommand({ QueueUrl: q, MessageBody: body }));
  return NextResponse.json({ ok: true }, { status: 200 });
}
