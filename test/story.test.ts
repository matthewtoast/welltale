import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

console.log("\n=== Tag Flow + Blocks ===");
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test01"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test01-session.json"))} \
    --openRouterBaseUrl ${process.env.OPENROUTER_BASE_URL} \
    --openRouterApiKey ${process.env.OPENROUTER_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY} \
    -i "input1" -i "invalid1" -i "invalid2" -i "Xylophone"
    `,
  { stdio: "inherit", cwd }
);

console.log("\n=== Intro Tag, Turn 1 ===");
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test02"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test02-session.json"))} \
    --openRouterBaseUrl ${process.env.OPENROUTER_BASE_URL} \
    --openRouterApiKey ${process.env.OPENROUTER_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}
    `,
  { stdio: "inherit", cwd }
);

console.log("\n=== Resume Tag, Turn 1 ===");
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test02"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test02-session.json"))} \
    --sessionResume \
    --sessionTurn 1 \
    --openRouterBaseUrl ${process.env.OPENROUTER_BASE_URL} \
    --openRouterApiKey ${process.env.OPENROUTER_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}
    `,
  { stdio: "inherit", cwd }
);

console.log("\n=== Test 3: Resume Tag + Previous Address ===");
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test02"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test02-session.json"))} \
    --sessionResume \
    --sessionTurn 1 \
    --sessionAddress "0.3" \
    --openRouterBaseUrl ${process.env.OPENROUTER_BASE_URL} \
    --openRouterApiKey ${process.env.OPENROUTER_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}
    `,
  { stdio: "inherit", cwd }
);
