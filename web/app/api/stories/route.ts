import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { loadAppEnv } from "../../../../env/env-app";
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
