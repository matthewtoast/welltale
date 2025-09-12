import { NextResponse } from "next/server";
import { getCompiled, getMeta, putMeta } from "lib/StoryRepo";
import { safeJsonParseTyped } from "lib/JSONHelpers";

export const runtime = "nodejs";

type UpdateBody = {
  title?: string;
  author?: string;
  description?: string;
  tags?: string[];
  publish?: "draft" | "published";
};

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const meta = await getMeta(id);
  if (!meta) return NextResponse.json({ ok: false }, { status: 404 });
  const compiled = await getCompiled(id);
  return NextResponse.json({ meta, compiled }, { status: 200 });
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const meta = await getMeta(id);
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
  const saved = await putMeta(next);
  return NextResponse.json({ meta: saved }, { status: 200 });
}

