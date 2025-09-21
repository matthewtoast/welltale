import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fetchDevSessions } from "../../lib/DevSessions";

async function main() {
  const root = join(process.cwd());
  const configPath = join(
    root,
    "ios",
    "Welltale",
    "Configurations",
    "Generated",
    "DevSession.xcconfig"
  );
  await mkdir(dirname(configPath), { recursive: true }).catch(() => {});
  const base = process.env.WELLTALE_API_BASE || "http://127.0.0.1:3000";
  const sessions = await fetchDevSessions(base).catch(() => []);
  const first = sessions[0] || null;
  const token = first?.token ?? "";
  const user = first?.user;
  const safe = (value: string | null | undefined): string => {
    if (!value) return "";
    const escaped = value.replace(/"/g, '\\"');
    return `"${escaped}"`;
  };
  const lines = [
    `DEV_SESSION_TOKEN = ${safe(token)}`,
    `DEV_SESSION_USER_ID = ${safe(user?.id)}`,
    `DEV_SESSION_USER_PROVIDER = ${safe(user?.provider)}`,
    `DEV_SESSION_USER_EMAIL = ${safe(user?.email)}`,
    `DEV_SESSION_USER_ROLES = ${safe(user?.roles?.join(","))}`,
    `INFOPLIST_KEY_DevSessionToken = $(DEV_SESSION_TOKEN)`,
    `INFOPLIST_KEY_DevSessionUserId = $(DEV_SESSION_USER_ID)`,
    `INFOPLIST_KEY_DevSessionUserProvider = $(DEV_SESSION_USER_PROVIDER)`,
    `INFOPLIST_KEY_DevSessionUserEmail = $(DEV_SESSION_USER_EMAIL)`,
    `INFOPLIST_KEY_DevSessionUserRoles = $(DEV_SESSION_USER_ROLES)`,
  ];
  const content = lines.join("\n") + "\n";
  await writeFile(configPath, content, "utf8").catch(async () => {
    await writeFile(configPath, content, "utf8");
  });
}

main();
