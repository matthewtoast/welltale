import { createRemoteJWKSet, jwtVerify } from "jose";
import { loadAppEnv } from "../../env/env-app";
import { cleanSplit } from "../TextHelpers";

export type ProviderAccount = {
  provider: "apple" | "dev";
  providerUserId: string;
  email: string | null;
};

const appleIssuer = "https://appleid.apple.com";
const appleKeys = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

const env = loadAppEnv();

export async function verifyAppleIdentityToken(
  token: string
): Promise<ProviderAccount | null> {
  const aud = cleanSplit(env.APPLE_AUDIENCE, ",");
  return jwtVerify(token, appleKeys, {
    issuer: appleIssuer,
    audience: aud,
  }).then((res) => {
    const payload = res.payload as Record<string, unknown>;
    const sub = payload.sub;
    if (typeof sub !== "string") return null;
    const email = typeof payload.email === "string" ? payload.email : null;
    return {
      provider: "apple",
      providerUserId: sub,
      email,
    } as ProviderAccount;
  });
}

export function verifyDevToken(token: string): ProviderAccount | null {
  const keys = cleanSplit(env.DEV_API_KEYS, ",");
  if (keys.length === 0) return null;
  const match = keys.find((k) => k === token);
  if (!match) return null;
  return {
    provider: "dev",
    providerUserId: match,
    email: null,
  } as ProviderAccount;
}
