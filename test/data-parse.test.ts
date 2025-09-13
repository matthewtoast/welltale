import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

const API_KEYS = `--openRouterBaseUrl ${process.env.OPENROUTER_BASE_URL} --openRouterApiKey ${process.env.OPENROUTER_API_KEY} --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}`;

console.log("\n=== Data Parse ===");
execSync(
  `yarn ts ./run/autorun.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test-data-parse"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test-data-parse-session.json"))}
    `,
  { stdio: "inherit", cwd }
);
