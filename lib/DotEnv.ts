import { config } from "dotenv";

export function loadEnv() {
  config({ path: ".env" });
  config({ path: ".env.local" });
}
