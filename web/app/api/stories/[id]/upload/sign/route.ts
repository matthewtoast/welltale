import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { loadAppEnv } from "../../../../../../../env/env-app";
import { authenticateRequest } from "../../../../../../lib/api/auth";
import { uploadKey } from "./../../../../../../../lib/StoryRepo";

const env = loadAppEnv();
const s3Client = new S3Client({});

export const runtime = "nodejs";

type StoryCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: StoryCtx) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const b = env.STORIES_BUCKET;
  if (!b) {
    console.warn("missing bucket");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const key = uploadKey(id);
  const cmd = new PutObjectCommand({
    Bucket: b,
    Key: key,
    ContentType: "application/zip",
  });
  const url = await getSignedUrl(s3Client as any, cmd as any, {
    expiresIn: 900,
  });
  return NextResponse.json(
    { method: "PUT", url, key, headers: { "Content-Type": "application/zip" } },
    { status: 200 }
  );
}
