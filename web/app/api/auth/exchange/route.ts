import { NextResponse } from "next/server";
import { safeJsonParseTyped } from "./../../../../../lib/JSONHelpers";
import { exchangeSession } from "./../../../../../lib/auth/service";

export const runtime = "nodejs";

type Body = {
  provider: "apple" | "dev";
  token: string;
};

export async function POST(req: Request) {
  const text = await req.text();
  const body = safeJsonParseTyped<Body>(
    text,
    (v) => typeof v?.provider === "string" && typeof v?.token === "string"
  );
  if (!body) {
    console.warn("invalid exchange body");
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const provider =
    body.provider === "apple"
      ? "apple"
      : body.provider === "dev"
        ? "dev"
        : null;
  if (!provider) {
    console.warn("unsupported provider");
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // "sec", "secs", "s"
  // "minute", "minutes", "m"
  // "hour", "hours", "h"
  // "day", "days", "d"
  // "week", "weeks", "w"
  // year", "years", and "y"
  const expirationTimeExpr = provider === "dev" ? "1y" : "15m";
  const result = await exchangeSession(
    provider,
    body.token,
    expirationTimeExpr
  );
  if (!result) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const user = {
    id: result.user.id,
    provider: result.user.provider,
    email: result.user.email,
    roles: result.user.roles,
  };
  return NextResponse.json(
    { ok: true, token: result.token, user },
    { status: 200 }
  );
}
