import { ulid } from "ulid";
import {
  findUserByProvider,
  getUser,
  saveUser,
  UserRecord,
} from "../UserRepo";
import { issueSessionToken, verifySessionToken } from "./session";
import {
  ProviderAccount,
  verifyAppleIdentityToken,
  verifyDevToken,
} from "./providers";

type ProviderId = ProviderAccount["provider"];

function ensureRoles(roles: string[] | null | undefined): string[] {
  if (!roles) return [];
  return roles;
}

async function upsertUser(
  account: ProviderAccount
): Promise<UserRecord | null> {
  const existing = await findUserByProvider(
    account.provider,
    account.providerUserId
  );
  const now = Date.now();
  if (!existing) {
    const record: UserRecord = {
      id: ulid(),
      provider: account.provider,
      providerUserId: account.providerUserId,
      email: account.email,
      roles: [],
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    await saveUser(record);
    return record;
  }
  const next: UserRecord = {
    ...existing,
    email: account.email,
    roles: ensureRoles(existing.roles),
    updatedAt: now,
  };
  await saveUser(next);
  return next;
}

async function issue(account: ProviderAccount): Promise<{
  token: string;
  user: UserRecord;
} | null> {
  const user = await upsertUser(account);
  if (!user) return null;
  const token = await issueSessionToken({
    uid: user.id,
    ver: user.sessionVersion,
    roles: ensureRoles(user.roles),
  });
  if (!token) return null;
  return { token, user };
}

function mapProvider(
  provider: ProviderId,
  proof: string
): Promise<ProviderAccount | null> {
  if (provider === "apple") return verifyAppleIdentityToken(proof);
  if (provider === "dev")
    return Promise.resolve(verifyDevToken(proof));
  return Promise.resolve(null);
}

export async function exchangeSession(
  provider: ProviderId,
  proof: string
): Promise<{ token: string; user: UserRecord } | null> {
  const account = await mapProvider(provider, proof);
  if (!account) return null;
  return issue(account);
}

export async function authenticateSession(
  token: string
): Promise<UserRecord | null> {
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const user = await getUser(claims.uid);
  if (!user) return null;
  if (user.sessionVersion !== claims.ver) return null;
  const roles = ensureRoles(user.roles);
  return { ...user, roles };
}
