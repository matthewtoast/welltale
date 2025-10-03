import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { NextResponse } from "next/server";
import { loadAppEnv } from "../../../../../../../env/env-app";
import { authenticateRequest } from "../../../../../../lib/api/auth";
import { createStoryRepo } from "./../../../../../../../lib/StoryRepo";

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
  console.log(`api:stories:complete ${id} user:${user.id}`);
  const meta = await storyRepo.getMeta(id);
  if (!meta) return NextResponse.json({ ok: false }, { status: 404 });
  meta.compile = "pending";
  meta.updatedAt = Date.now();
  await storyRepo.putMeta(meta);
  console.log(`api:stories:complete:enqueue ${id} queue:${q}`);
  const c = new SQSClient({});
  const body = JSON.stringify({ type: "compile", id });
  const op = await c.send(
    new SendMessageCommand({ QueueUrl: q, MessageBody: body })
  );
  console.log(`api:stories:complete:sent ${id}`);
  console.log(op);
  return NextResponse.json({ ok: true }, { status: 200 });
}
