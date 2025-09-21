import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { loadAppEnv } from "../../../../env/env-app";
import { safeJsonParseTyped } from "./../../../../lib/JSONHelpers";
import { createStoryRepo } from "./../../../../lib/StoryRepo";
import { authenticateRequest } from "./../../../../lib/api/auth";

const env = loadAppEnv();
const storyRepo = createStoryRepo({
  ddb: new DynamoDBClient({}),
  tableName: env.STORIES_TABLE,
  s3: new S3Client({}),
  bucketName: env.STORIES_BUCKET,
});

export const runtime = "nodejs";

type CreateBody = {
  title: string;
  author: string;
  description: string;
  tags: string[];
  publish?: "draft" | "published";
};

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").toLowerCase();
  const metas = await storyRepo.listMetas();
  const items = metas.filter((m) => {
    if (!q) return true;
    const hay = [m.title, m.author, m.description, ...(m.tags || [])]
      .join("\n")
      .toLowerCase();
    return hay.includes(q);
  });
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const t = await req.text();
  const b = safeJsonParseTyped<CreateBody>(
    t,
    (v) => typeof v?.title === "string"
  );
  if (!b) {
    console.warn("invalid body");
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const id = ulid();
  const now = Date.now();
  const meta = await storyRepo.putMeta({
    id,
    title: b.title,
    author: b.author,
    description: b.description,
    tags: b.tags || [],
    publish: b.publish || "draft",
    compile: "pending",
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ id, meta }, { status: 200 });
}
