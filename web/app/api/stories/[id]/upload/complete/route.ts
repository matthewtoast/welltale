import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { NextResponse } from "next/server";
import { getMeta, putMeta } from "./../../../../../../../lib/StoryRepo";
import { authenticateRequest } from "./../../../../../../../lib/api/auth";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
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
