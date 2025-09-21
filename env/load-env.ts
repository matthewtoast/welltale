import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnvFile(metaUrl: string, name: string) {
  const dir = dirname(fileURLToPath(metaUrl));
  config({ path: join(dir, name), quiet: true });
}
