import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");
const API_KEYS = `--openRouterBaseUrl ${process.env.OPENROUTER_BASE_URL} --openRouterApiKey ${process.env.OPENROUTER_API_KEY} --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}`;
execSync(
  `yarn ts ./run/auto.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test-block-order"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test-block-order-session.json"))} \
    -i "input1" -i "invalid1" -i "invalid2" -i "Xylophone"
    `,
  { stdio: "inherit", cwd }
);
