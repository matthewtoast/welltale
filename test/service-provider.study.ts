import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dedent from "dedent";
import { loadEnv } from "lib/DotEnv";
import { LocalCache } from "lib/LocalCache";
import {
  DefaultStoryServiceProvider,
  MockStoryServiceProvider,
} from "lib/StoryServiceProvider";
import { DEFAULT_LLM_SLUGS } from "lib/StoryTypes";
import OpenAI from "openai";
import { homedir } from "os";
import { join } from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function go() {
  loadEnv();

  const argv = await yargs(hideBin(process.argv))
    .option("mock", {
      type: "boolean",
      description: "Use mock service provider for service calls",
      default: false,
    })
    .option("openRouterApiKey", {
      type: "string",
      description: "OpenAI API key",
      default: process.env.OPENROUTER_API_KEY!,
    })
    .option("openRouterBaseUrl", {
      type: "string",
      description: "OpenRouter base URL",
      default: process.env.OPENROUTER_BASE_URL!,
    })
    .option("elevenlabsKey", {
      type: "string",
      description: "ElevenLabs API key",
      default: process.env.ELEVENLABS_API_KEY!,
    })
    .option("cacheDir", {
      type: "string",
      default: join(homedir(), ".welltale", "cache"),
      description: "Directory for caching generated content",
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  const provider = argv.mock
    ? new MockStoryServiceProvider()
    : new DefaultStoryServiceProvider(
        {
          eleven: new ElevenLabsClient({ apiKey: argv.elevenlabsKey }),
          openai: new OpenAI({
            apiKey: argv.openRouterApiKey,
            baseURL: argv.openRouterBaseUrl,
          }),
          cache: new LocalCache(argv.cacheDir),
        },
        {
          disableCache: false,
          verbose: true,
        }
      );

  const i1 = await provider.generateJson(
    dedent`
      Extract the most appropriate value of type "string" from the input, per the instruction, conforming to the pattern.
      <input>My name is John Smith</input>
      <instruction>The user's first name</instruction>
      <pattern>[A-Za-z]+</pattern>
    `,
    { value: "string" },
    {
      models: DEFAULT_LLM_SLUGS,
      useWebSearch: false,
    }
  );
  console.log(i1);

  const i2 = await provider.generateJson(
    dedent`
      Generate data per the instruction, conforming to the schema.
      <instruction>Character data for an old knight of the round table</instruction>
    `,
    {
      charAge: "number - The character's age",
      charName: "The full name, with honorific",
    },
    {
      models: DEFAULT_LLM_SLUGS,
      useWebSearch: false,
    }
  );
  console.log(i2);

  // Note: This takes about 60 seconds
  const i3 = await provider.generateVoice(
    dedent`
      A very enthusiastic baseball announcer speaking as if in the final inning, tied with bases loaded.
      High tension and excitement, suspense is in the air
    `,
    {}
  );
  console.log(i3);

  const i4 = await provider.generateSpeech(
    {
      speaker: "Announcer",
      body: `${i2.charName}, the ${i2.charAge}-year-old phenom, rides onto the battlefield upon his trusty steed`,
      voice: "",
      tags: [],
      pronunciations: {},
    },
    [{ ...i3, tags: [], name: "BaseballGuy", ref: "" }],
    {}
  );
  console.log(i4);

  const i5 = await provider.generateSound(
    "Sounds of horses hooves and swords clashing, a chaotic medieval battlefield",
    5_000,
    {}
  );
  console.log(i5);

  const i6 = await provider.generateMusic(
    "Cinematic music, an elderly knight riding out for what's sure ot be his final battle, symphonic, tragic",
    30_000,
    {}
  );
  console.log(i6);
}

go();
