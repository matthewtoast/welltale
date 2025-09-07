import { execSync } from "child_process";
import { loadEnv } from "lib/DotEnv";
import { quo } from "lib/JSONHelpers";
import { join } from "path";

loadEnv();

const cwd = join(__dirname, "..");

const API_KEYS = `--openRouterBaseUrl ${process.env.OPENROUTER_BASE_URL} --openRouterApiKey ${process.env.OPENROUTER_API_KEY} --elevenlabsKey ${process.env.ELEVENLABS_API_KEY}`;

console.log(`
---
Basic test of the input system with mix of valid and invalid
~~ Expected ~~
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
  `yarn ts ./run/autorun.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test03"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test03-session.json"))} \
    -i "Alice" -i "28" -i "invalid" -i "alice+foo@example.com" -i "invalid" -i "warrior"
    `,
  { stdio: "inherit", cwd }
);

console.log(`
---
Now test: blank age uses default, valid email, class mage
~~ Expected ~~
HOST: Welcome! Let's test the input system.
HOST: What's your name?
> Bob
HOST: Hello {{Bob}}!
HOST: What age are you?
>
HOST: You are {{25}} years old.
HOST: What's your email?
> bob@example.com
HOST: What class are you?
> mage
HOST: You are a mage.
HOST: Test complete!
---
`);
execSync(
  `yarn ts ./run/autorun.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test03"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test03b-session.json"))} \
    -i "Bob" -i "" -i "bob@example.com" -i "mage"
    `,
  { stdio: "inherit", cwd }
);

console.log(`
---
Now test: class retries exhausted, no failover -> ERROR seam
~~ Expected ~~
HOST: Welcome! Let's test the input system.
HOST: What's your name?
> Carol
HOST: Hello Carol!
HOST: What age are you?
> 30
HOST: You are 30 years old.
HOST: What's your email?
> carol@example.com
HOST: Your email is carol@example.com.
HOST: What class are you?
> invalid
HOST: Once again...
HOST: What. Class. ARE YOU!?
> invalid
ERROR: Input failed for fields [class]. Last value: invalid
---
`);
execSync(
  `yarn ts ./run/autorun.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test03"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test03c-session.json"))} \
    -i "Carol" -i "30" -i "carol@example.com" -i "invalid" -i "invalid" -i "invalid"
    `,
  { stdio: "inherit", cwd }
);

console.log(`
---
Now test: retries exhausted with explicit failover
~~ Expected ~~
HOST: Welcome! Let's test failover.
HOST: What's your name?
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
  `yarn ts ./run/autorun.ts ${API_KEYS} \
    --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test04"))} \
    --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test04-session.json"))} \
    -i "Dan" -i "invalid"
    `,
  { stdio: "inherit", cwd }
);

// console.log(`
// ---
// Now test: multi-field capture with a single input
// Expected highlights:
// > {"first_name":"Alice","surname":"Jones","age":28}
// HOST: Hello Alice Jones!
// HOST: You are 28.
// HOST: Test complete!
// ---
// `);
// execSync(
//   `yarn ts ./run/autorun.ts ${API_KEYS} \
//     --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test05"))} \
//     --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test05-session.json"))} \
//     -i '{"first_name":"Alice","surname":"Jones","age":28}'
//     `,
//   { stdio: "inherit", cwd }
// );

// console.log(`
// ---
// Now test: multi-field capture with first attempt invalid, then valid
// Expected highlights:
// HOST: Something wasn’t right.
// > {"first_name":"Bob","surname":"Smith","age":21}
// HOST: Hello Bob Smith!
// HOST: You are 21.
// ---
// `);
// execSync(
//   `yarn ts ./run/autorun.ts ${API_KEYS} \
//     --cartridgeDir ${quo(join(cwd, "test/fixtures/cartridges/test05"))} \
//     --sessionPath ${quo(join(cwd, "test/fixtures/sessions/test05-session.json"))} \
//     -i '{"first_name":"","surname":"","age":"invalid"}' -i '{"first_name":"Bob","surname":"Smith","age":21}'
//     `,
//   { stdio: "inherit", cwd }
// );
