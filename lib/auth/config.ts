let cachedSecret: string | null = null;
let cachedDevKeys: string[] | null = null;
let cachedAppleAud: string[] | null = null;

export function authSecret(): string | null {
  if (cachedSecret !== null) return cachedSecret;
  const raw = process.env.AUTH_SECRET || "";
  if (!raw) {
    console.warn("missing auth secret");
    cachedSecret = null;
    return cachedSecret;
  }
  cachedSecret = raw;
  return cachedSecret;
}

export function devApiKeys(): string[] {
  if (cachedDevKeys) return cachedDevKeys;
  const raw = process.env.DEV_API_KEYS || "";
  const keys = raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  cachedDevKeys = keys;
  return cachedDevKeys;
}

export function appleAudiences(): string[] {
  if (cachedAppleAud) return cachedAppleAud;
  const raw = process.env.APPLE_AUDIENCE || "";
  const values = raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  cachedAppleAud = values;
  if (cachedAppleAud.length === 0) {
    console.warn("missing apple audience");
  }
  return cachedAppleAud;
}
