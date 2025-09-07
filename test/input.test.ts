import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

console.log("\n=== Test 4: Input System ===");
console.log(`
The rendered output of this test should be:
HOST: Welcome! Let's test the input system.
HOST: What's your name?
> Alice
HOST: Hello Alice!
HOST: What age are you?
> 28
HOST: You are 28 years old.
HOST: What's your email?
> invalid
HOST: Please enter a valid email address.
> alice+foo@example.com
HOST: Your email is alice+foo@example.com.
HOST: What class are you?
> invalid
HOST: Once again...
HOST: What. Class. ARE YOU!?
> warrior
HOST: You are a warrior.
HOST: Test complete!
`);
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test03"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test03-session.json"))} \
    --openRouterApiKey ${process.env.OPENROUTER_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY} \
    -i "Alice" -i "28" -i -i "invalid" -i "alice@example.com -i "invalid" -i "warrior"
    `,
  { stdio: "inherit", cwd }
);
