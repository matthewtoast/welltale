import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getMeta, putMeta } from "lib/StoryRepo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const q = process.env.JOBS_QUEUE_URL || "";
  if (!q) {
    console.warn("missing queue");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const meta = await getMeta(id);
  if (!meta) return NextResponse.json({ ok: false }, { status: 404 });
  meta.compile = "pending";
  meta.updatedAt = Date.now();
  await putMeta(meta);
  const c = new SQSClient({});
  const body = JSON.stringify({ type: "compile", id });
  await c.send(new SendMessageCommand({ QueueUrl: q, MessageBody: body }));
  return NextResponse.json({ ok: true }, { status: 200 });
}
