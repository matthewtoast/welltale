import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

console.log(`
=== Input System ===

The rendered output of this test should be:
---
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
---
`);
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test03"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test03-session.json"))} \
    --openRouterApiKey ${process.env.OPENROUTER_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY} \
    -i "Alice" -i "28" -i -i "invalid" -i "alice+foo@example.com" -i "invalid" -i "warrior"
    `,
  { stdio: "inherit", cwd }
);

console.log(`
---
Now test: blank age uses default, valid email, class mage
Expected highlights:
> Bob
HOST: You are 25 years old.
HOST: Your email is bob@example.com.
HOST: You are a mage.
---
`);
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test03"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test03b-session.json"))} \
    --openRouterApiKey ${process.env.OPENROUTER_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY} \
    -i "Bob" -i "" -i "bob@example.com" -i "mage"
    `,
  { stdio: "inherit", cwd }
);

console.log(`
---
Now test: class retries exhausted, no failover -> ERROR seam
Expected highlights:
> Carol
HOST: Once again...
HOST: What. Class. ARE YOU!?
Then terminate with ERROR.
---
`);
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test03"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test03c-session.json"))} \
    --openRouterApiKey ${process.env.OPENROUTER_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY} \
    -i "Carol" -i "30" -i "carol@example.com" -i "invalid" -i "invalid" -i "invalid"
    `,
  { stdio: "inherit", cwd }
);

console.log(`
---
Now test: retries exhausted with explicit failover
Expected highlights:
> Dan
HOST: Hello Dan!
HOST: Choose your class.
> invalid
HOST: Once again...
HOST: Failover path taken.
HOST: Test complete!
---
`);
execSync(
  `yarn ts ./run/autorun.ts \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test04"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test04-session.json"))} \
    --openRouterApiKey ${process.env.OPENROUTER_API_KEY} \
    --elevenlabsKey ${process.env.ELEVENLABS_API_KEY} \
    -i "Dan" -i "invalid"
    `,
  { stdio: "inherit", cwd }
);
