import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { safeJsonParseTyped } from "./../../../../lib/JSONHelpers";
import { listMetas, putMeta } from "./../../../../lib/StoryRepo";
import { authenticateRequest } from "./../../../../lib/api/auth";

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
  const metas = await listMetas();
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
  const meta = await putMeta({
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
