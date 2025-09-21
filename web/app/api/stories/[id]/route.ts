import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { loadAppEnv } from "./../../../../../env-app";
import { safeJsonParseTyped } from "./../../../../../lib/JSONHelpers";
import { createStoryRepo } from "./../../../../../lib/StoryRepo";
import { authenticateRequest } from "./../../../../../lib/api/auth";

export const runtime = "nodejs";

const env = loadAppEnv();
const storyRepo = createStoryRepo({
  ddb: new DynamoDBClient({}),
  tableName: env.STORIES_TABLE,
  s3: new S3Client({}),
  bucketName: env.STORIES_BUCKET,
});

type UpdateBody = {
  title?: string;
  author?: string;
  description?: string;
  tags?: string[];
  publish?: "draft" | "published";
};

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const id = ctx.params.id;
  const meta = await storyRepo.getMeta(id);
  if (!meta) return NextResponse.json({ ok: false }, { status: 404 });
  const compiled = await storyRepo.getCompiled(id);
  return NextResponse.json({ meta, compiled }, { status: 200 });
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const id = ctx.params.id;
  const meta = await storyRepo.getMeta(id);
  if (!meta) return NextResponse.json({ ok: false }, { status: 404 });
  const t = await req.text();
  const b = safeJsonParseTyped<UpdateBody>(t);
  const next = {
    ...meta,
    title: b?.title ?? meta.title,
    author: b?.author ?? meta.author,
    description: b?.description ?? meta.description,
    tags: b?.tags ?? meta.tags,
    publish: b?.publish ?? meta.publish,
    updatedAt: Date.now(),
  };
  const saved = await storyRepo.putMeta(next);
  return NextResponse.json({ meta: saved }, { status: 200 });
}
