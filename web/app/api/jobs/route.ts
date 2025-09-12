import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

export async function POST() {
  const q = process.env.JOBS_QUEUE_URL || "";
  if (!q) {
    console.warn("JOBS_QUEUE_URL missing");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const c = new SQSClient({});
  const body = JSON.stringify({ type: "hello" });
  await c.send(new SendMessageCommand({ QueueUrl: q, MessageBody: body }));
  return NextResponse.json({ ok: true }, { status: 200 });
}
