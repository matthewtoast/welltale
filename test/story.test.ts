import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/teststory"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/teststory-session.json"))} \
    --openaiKey ${process.env.OPENAI_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY} \
    -i "input1" -i "invalid1" -i "invalid2" -i "Xylophone"
    `,
  { stdio: "inherit", cwd }
);
