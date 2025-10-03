import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { loadAppEnv } from "../../../../../env/env-app";
import { authenticateRequest } from "../../../../lib/api/auth";
import { safeJsonParseTyped } from "./../../../../../lib/JSONHelpers";
import { createStoryRepo } from "./../../../../../lib/StoryRepo";

export const runtime = "nodejs";

const env = loadAppEnv();
const storyRepo = createStoryRepo({
  ddb: new DynamoDBClient({}),
  tableName: env.STORIES_TABLE,
  s3: new S3Client({}),
  bucketName: env.STORIES_BUCKET,
});

type StoryCtx = { params: Promise<{ id?: string }> };

type UpdateBody = {
  id?: string;
  title?: string;
  author?: string;
  description?: string;
  tags?: string[];
  publish?: "draft" | "published";
};

export async function GET(req: Request, ctx: StoryCtx) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const params = await ctx.params;
  const id = params?.id;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  console.log(`api:stories:get ${id} user:${user.id}`);
  const meta = await storyRepo.getMeta(id);
  return NextResponse.json({ meta }, { status: 200 });
}

export async function POST(req: Request, ctx: StoryCtx) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const params = await ctx.params;
  const t = await req.text();
  const b = safeJsonParseTyped<UpdateBody>(t);
  const bodyId = b?.id?.trim();
  const pathId = params?.id?.trim();
  const id =
    bodyId && bodyId.length > 0
      ? bodyId
      : pathId && pathId.length > 0
        ? pathId
        : ulid();
  const meta = await storyRepo.getMeta(id);
  const now = Date.now();
  console.log(`api:stories:post ${id} user:${user.id} meta:${meta ? "update" : "create"}`);
  if (!meta) {
    const next = {
      id,
      title: b?.title ?? "",
      author: b?.author ?? "",
      description: b?.description ?? "",
      tags: Array.isArray(b?.tags) ? (b?.tags ?? []) : [],
      publish: b?.publish ?? "draft",
      compile: "pending" as const,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await storyRepo.putMeta(next);
    return NextResponse.json({ id, meta: saved }, { status: 200 });
  }
  const next = {
    ...meta,
    title: b?.title ?? meta.title,
    author: b?.author ?? meta.author,
    description: b?.description ?? meta.description,
    tags: Array.isArray(b?.tags) ? (b?.tags ?? meta.tags) : meta.tags,
    publish: b?.publish ?? meta.publish,
    updatedAt: now,
  };
  const saved = await storyRepo.putMeta(next);
  return NextResponse.json({ id, meta: saved }, { status: 200 });
}
