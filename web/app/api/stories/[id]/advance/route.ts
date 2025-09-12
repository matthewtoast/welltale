import { NextResponse } from "next/server";
import { getCompiled } from "lib/StoryRepo";
import { safeJsonParseTyped } from "lib/JSONHelpers";
import { advanceStory } from "lib/StoryEngine";
import { StoryOptions, StorySession, StorySource } from "lib/StoryTypes";
import { MockStoryServiceProvider } from "lib/StoryServiceProvider";

export const runtime = "nodejs";

type Body = {
  session: StorySession;
  options: StoryOptions;
};

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const comp = await getCompiled(id);
  if (!comp) return NextResponse.json({ ok: false }, { status: 404 });
  const t = await req.text();
  const b = safeJsonParseTyped<Body>(t);
  if (!b) return NextResponse.json({ ok: false }, { status: 400 });
  const provider = new MockStoryServiceProvider();
  const src = comp as StorySource;
  const { ops, session, seam, info } = await advanceStory(provider, src, b.session, b.options);
  return NextResponse.json({ ops, session, seam, info }, { status: 200 });
}

