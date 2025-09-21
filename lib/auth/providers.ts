import { createRemoteJWKSet, jwtVerify } from "jose";
import { appleAudiences, devApiKeys } from "./config";

export type ProviderAccount = {
  provider: "apple" | "dev";
  providerUserId: string;
  email: string | null;
};

const appleIssuer = "https://appleid.apple.com";
const appleKeys = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

export async function verifyAppleIdentityToken(
  token: string
): Promise<ProviderAccount | null> {
  const aud = appleAudiences();
  if (aud.length === 0) return null;
  return jwtVerify(token, appleKeys, {
    issuer: appleIssuer,
    audience: aud,
  })
    .then((res) => {
      const payload = res.payload as Record<string, unknown>;
      const sub = payload.sub;
      if (typeof sub !== "string") return null;
      const email = typeof payload.email === "string" ? payload.email : null;
      return { provider: "apple", providerUserId: sub, email } as ProviderAccount;
    })
    .catch((err) => {
      console.warn("apple token verify failed", err);
      return null;
    });
}

export function verifyDevToken(token: string): ProviderAccount | null {
  const keys = devApiKeys();
  if (keys.length === 0) return null;
  const match = keys.find((k) => k === token);
  if (!match) return null;
  return { provider: "dev", providerUserId: match, email: null } as ProviderAccount;
}
