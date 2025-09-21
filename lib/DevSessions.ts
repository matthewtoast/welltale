import { loadEnv } from "./DotEnv";

type ApiUser = {
  id: string;
  provider: string;
  email: string | null;
  roles: string[];
};

type ExchangeResponse = {
  ok: boolean;
  token: string;
  user: ApiUser;
};

loadEnv();

function baseUrl(defaultBase: string): string {
  const value = process.env.WELLTALE_API_BASE || defaultBase;
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function devKeys(): string[] {
  const raw = process.env.DEV_API_KEYS || "";
  return raw
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

async function exchange(base: string, key: string): Promise<DevSession | null> {
  const res = await fetch(`${base}/api/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "dev", token: key }),
  }).catch(() => null);
  if (!res) return null;
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as ExchangeResponse | null;
  if (!data) return null;
  if (!data.ok) return null;
  if (!data.token) return null;
  if (!data.user) return null;
  const roles = Array.isArray(data.user.roles)
    ? data.user.roles.filter((role) => typeof role === "string")
    : [];
  const user: ApiUser = {
    id: data.user.id,
    provider: data.user.provider,
    email:
      typeof data.user.email === "string" && data.user.email.length > 0
        ? data.user.email
        : null,
    roles,
  };
  return { token: data.token, user };
}

export type DevSession = {
  token: string;
  user: ApiUser;
};

export async function fetchDevSessions(
  defaultBase: string
): Promise<DevSession[]> {
  const base = baseUrl(defaultBase);
  if (!base) return [];
  const keys = devKeys();
  if (keys.length === 0) return [];
  const results: DevSession[] = [];
  for (const key of keys) {
    const token = await exchange(base, key);
    if (token) results.push(token);
  }
  return results;
}
