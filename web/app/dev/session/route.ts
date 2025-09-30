import { NextRequest, NextResponse } from "next/server";
import { getDevSessionToken } from "../../../lib/devSession";

export function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const dest = req.nextUrl.searchParams.get("next") ?? "/";
    const safe = dest.startsWith("/") ? dest : "/";
    return NextResponse.redirect(new URL(safe, req.nextUrl.origin));
  }
  const token = getDevSessionToken();
  const dest = req.nextUrl.searchParams.get("next") ?? "/";
  const safe = dest.startsWith("/") ? dest : "/";
  const res = NextResponse.redirect(new URL(safe, req.nextUrl.origin));
  if (token) {
    res.cookies.set({
      name: "session",
      value: token,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
  }
  return res;
}
