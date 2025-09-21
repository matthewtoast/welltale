import { authenticateSession } from "../auth/service";
import { UserRecord } from "../UserRepo";

function fromAuthorization(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

function parseCookies(raw: string): Record<string, string> {
  const pairs = raw.split(";");
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    if (!name) continue;
    const value = pair.slice(index + 1).trim();
    out[name] = value;
  }
  return out;
}

function fromCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const cookies = parseCookies(header);
  if (!cookies.session) return null;
  return cookies.session;
}

export async function authenticateRequest(
  req: Request
): Promise<UserRecord | null> {
  const token = fromAuthorization(req) || fromCookie(req);
  if (!token) return null;
  return authenticateSession(token);
}
