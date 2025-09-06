import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

// Test 0: Run the core test showing story flow thru many tag types
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

// Test 1: Basic intro test (turn 1, no resume)
console.log("\n=== Test 1: Basic intro (turn 1) ===");
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test02"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test02-session.json"))} \
    --openaiKey ${process.env.OPENAI_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}
    `,
  { stdio: "inherit", cwd }
);

// Test 2: Resume test (turn 1 with resume flag)
console.log("\n=== Test 2: Resume (turn 1, resume=true) ===");
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test02"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test02-session.json"))} \
    --sessionResume \
    --sessionTurn 1 \
    --openaiKey ${process.env.OPENAI_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}
    `,
  { stdio: "inherit", cwd }
);

// Test 3: Resume test with specific address (turn 1 with resume flag and address at div)
console.log(
  "\n=== Test 3: Resume with address (turn 1, resume=true, address=0.3) ==="
);
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test02"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test02-session.json"))} \
    --sessionResume \
    --sessionTurn 1 \
    --sessionAddress "0.3" \
    --openaiKey ${process.env.OPENAI_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}
    `,
  { stdio: "inherit", cwd }
);
