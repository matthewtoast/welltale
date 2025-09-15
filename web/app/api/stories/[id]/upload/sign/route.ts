import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucket, s3, uploadKey } from "lib/StoryRepo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const b = bucket();
  if (!b) {
    console.warn("missing bucket");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const key = uploadKey(id);
  const client = s3();
  const cmd = new PutObjectCommand({
    Bucket: b,
    Key: key,
    ContentType: "application/zip",
  });
  const url = await getSignedUrl(client as any, cmd as any, { expiresIn: 900 });
  return NextResponse.json(
    { method: "PUT", url, key, headers: { "Content-Type": "application/zip" } },
    { status: 200 }
  );
}
