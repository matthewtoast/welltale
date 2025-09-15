import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

const API_KEYS = `--openRouterBaseUrl ${process.env.OPENROUTER_BASE_URL} --openRouterApiKey ${process.env.OPENROUTER_API_KEY} --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}`;

execSync(
  `yarn ts ./run/autorun.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test-intro-resume"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test-intro-resume-session.json"))}
    `,
  { stdio: "inherit", cwd }
);

execSync(
  `yarn ts ./run/autorun.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test-intro-resume"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test-intro-resume-session.json"))} \
    --sessionResume \
    --sessionTurn 1
    `,
  { stdio: "inherit", cwd }
);

execSync(
  `yarn ts ./run/autorun.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test-intro-resume"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test-intro-resume-session.json"))} \
    --sessionResume \
    --sessionTurn 1 \
    --sessionAddress "0.3"
    `,
  { stdio: "inherit", cwd }
);
