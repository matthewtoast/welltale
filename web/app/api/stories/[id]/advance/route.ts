import { NextResponse } from "next/server";
import { safeJsonParseTyped } from "./../../../../../../lib/JSONHelpers";
import { advanceStory } from "./../../../../../../lib/StoryEngine";
import { getCompiled } from "./../../../../../../lib/StoryRepo";
import { MockStoryServiceProvider } from "./../../../../../../lib/StoryServiceProvider";
import {
  StoryOptions,
  StorySession,
  StorySource,
} from "./../../../../../../lib/StoryTypes";
import { authenticateRequest } from "./../../../../../../lib/api/auth";

export const runtime = "nodejs";

type Body = {
  session: StorySession;
  options: StoryOptions;
};

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const id = ctx.params.id;
  const comp = await getCompiled(id);
  if (!comp) return NextResponse.json({ ok: false }, { status: 404 });
  const t = await req.text();
  const b = safeJsonParseTyped<Body>(t);
  if (!b) return NextResponse.json({ ok: false }, { status: 400 });
  const provider = new MockStoryServiceProvider();
  const src = comp as StorySource;
  const { ops, session, seam, info } = await advanceStory(
    provider,
    src,
    b.session,
    b.options
  );
  return NextResponse.json({ ops, session, seam, info }, { status: 200 });
}
