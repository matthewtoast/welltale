import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

// Run ABCDE basic story
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test01"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test01-session.json"))} \
    --openaiKey ${process.env.OPENAI_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY} \
    -i "input1" -i "invalid1" -i "invalid2" -i "Xylophone"
    `,
  { stdio: "inherit", cwd }
);

// Test intro
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test02"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test02-session.json"))} \
    --openaiKey ${process.env.OPENAI_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}
    `,
  { stdio: "inherit", cwd }
);

// Test resume
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test02"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test02-session.json"))} \
    --sessionResume \
    --sessionTurn 2 \
    --openaiKey ${process.env.OPENAI_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}
    `,
  { stdio: "inherit", cwd }
);
