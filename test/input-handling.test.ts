import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

const API_KEYS = `--openRouterBaseUrl ${process.env.OPENROUTER_BASE_URL} --openRouterApiKey ${process.env.OPENROUTER_API_KEY} --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}`;

console.log(`
---
Basic test of the input system (no built-in retries)
~~ Expected ~~
HOST: What's your name?
> Alice
HOST: Hello Alice!
HOST: What age are you?
> 28
HOST: You are 28 years old.
HOST: What's your email?
> alice+foo@example.com
HOST: Your email is alice+foo@example.com.
HOST: What class are you?
> warrior
HOST: You are a warrior.
---
`);
execSync(
  `yarn ts ./run/auto.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test-input-handling"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test-input-handling-session.json"))} \
    -i "Alice" -i "28" -i "alice+foo@example.com" -i "warrior"
    `,
  { stdio: "inherit", cwd }
);

console.log(`
---
Now test: blank age uses default, valid email, class mage
~~ Expected ~~
HOST: What's your name?
> Bob
HOST: Hello Bob!
HOST: What age are you?
>
HOST: You are 25 years old.
HOST: What's your email?
> invalid
HOST: Your email is user@example.com.
HOST: What class are you?
> mage
HOST: You are a mage.
---
`);
execSync(
  `yarn ts ./run/auto.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test-input-handling"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test-input-handlingb-session.json"))} \
    -i "Bob" -i "" -i "invalid" -i "mage"
    `,
  { stdio: "inherit", cwd }
);
