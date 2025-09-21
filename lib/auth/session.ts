import { SignJWT, jwtVerify } from "jose";
import { loadAppEnv } from "../../env/env-app";

type SessionClaims = {
  uid: string;
  ver: number;
  roles: string[];
};

let cachedKey: Uint8Array | null = null;

const env = loadAppEnv();

function key(): Uint8Array | null {
  if (cachedKey) return cachedKey;
  const secret = env.AUTH_SECRET;
  if (!secret) return null;
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function issueSessionToken(
  claims: SessionClaims
): Promise<string | null> {
  const k = key();
  if (!k) return null;
  const token = await new SignJWT({
    uid: claims.uid,
    ver: claims.ver,
    roles: claims.roles,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(k)
    .catch((err) => {
      console.warn("failed to sign session", err);
      return null as string | null;
    });
  if (!token) return null;
  return token;
}

export async function verifySessionToken(
  token: string
): Promise<SessionClaims | null> {
  const k = key();
  if (!k) return null;
  return jwtVerify(token, k)
    .then((res) => {
      const payload = res.payload as Record<string, unknown>;
      const uid = payload.uid;
      const ver = payload.ver;
      const roles = payload.roles;
      if (typeof uid !== "string") return null;
      if (typeof ver !== "number") return null;
      if (!Array.isArray(roles)) return null;
      if (roles.some((r) => typeof r !== "string")) return null;
      return { uid, ver, roles: roles as string[] };
    })
    .catch((err) => {
      console.warn("invalid session token", err);
      return null;
    });
}
