import { StoryAdvanceResult, StoryOptions, StorySession } from "./StoryTypes";

export type StorySpec = {
  title: string;
  author: string;
  description: string;
  tags: string[];
};

export type UploadTicket = {
  method: string;
  url: string;
  headers: Record<string, string>;
};

export type ApiUser = {
  id: string;
  provider: string;
  email: string | null;
  roles: string[];
};

export type ExchangeResponse = {
  ok: boolean;
  token: string;
  user: ApiUser;
};
export type DevSession = {
  token: string;
  user: ApiUser;
};

export async function authTokenExchange(
  baseUrl: string,
  key: string
): Promise<DevSession | null> {
  const res = await fetch(`${baseUrl}/api/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "dev", token: key }),
  }).catch((err) => {
    console.log(err);
    return null;
  });
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

export async function fetchDevSessions(
  baseUrl: string,
  devKeys: string[]
): Promise<DevSession[]> {
  if (devKeys.length === 0) return [];
  const results: DevSession[] = [];
  for (const key of devKeys) {
    const token = await authTokenExchange(baseUrl, key);
    if (token) results.push(token);
  }
  return results;
}

export async function saveMeta(
  baseUrl: string,
  id: string,
  spec: StorySpec,
  token: string
): Promise<boolean> {
  const payload = JSON.stringify(spec);
  const res = await safeRequest(
    `${baseUrl}/api/stories/${id}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    },
    token
  );
  if (!res) return false;
  if (!res.ok) return false;
  return true;
}

export async function requestUpload(
  baseUrl: string,
  id: string,
  token: string
): Promise<UploadTicket | null> {
  const res = await safeRequest(
    `${baseUrl}/api/stories/${id}/upload/sign`,
    {
      method: "POST",
    },
    token
  );
  if (!res) return null;
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  if (typeof data.method !== "string") return null;
  if (typeof data.url !== "string") return null;
  if (!data.headers || typeof data.headers !== "object") return null;
  const headers: Record<string, string> = {};
  for (const key of Object.keys(data.headers)) {
    const v = data.headers[key];
    if (typeof v === "string") headers[key] = v;
  }
  return { method: data.method, url: data.url, headers };
}

export async function uploadZip(
  ticket: UploadTicket,
  zip: Buffer
): Promise<boolean> {
  const headers = { ...ticket.headers, "Content-Length": `${zip.byteLength}` };
  const res = await safeRequest(
    ticket.url,
    {
      method: ticket.method,
      headers,
      body: new Uint8Array(zip),
    },
    null
  );
  if (!res) return false;
  if (!res.ok) return false;
  return true;
}

export async function finalizeUpload(
  base: string,
  id: string,
  token: string
): Promise<boolean> {
  const res = await safeRequest(
    `${base}/api/stories/${id}/upload/complete`,
    {
      method: "POST",
    },
    token
  );
  if (!res) return false;
  if (!res.ok) return false;
  return true;
}

export async function advanceStory(
  baseUrl: string,
  id: string,
  session: StorySession,
  options: StoryOptions,
  token: string
): Promise<StoryAdvanceResult | null> {
  const payload = JSON.stringify({ session, options });
  const res = await safeRequest(
    `${baseUrl}/api/stories/${id}/advance`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    },
    token
  );
  if (!res) return null;
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  return data as StoryAdvanceResult;
}

async function safeRequest(
  url: string,
  init: RequestInit,
  token: string | null
): Promise<Response | null> {
  const headers = { ...(init.headers || {}) } as Record<string, string>;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers }).catch(() => null as any);
  if (!res) return null;
  return res;
}
