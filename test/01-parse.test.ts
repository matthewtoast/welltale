import { camelCase } from "lodash";
import zodToJsonSchema from "zod-to-json-schema";
import { autoFindVoice } from "../lib/ElevenLabsUtils";
import { ELEVENLABS_PRESET_VOICES } from "../lib/ElevenLabsVoices";
import { castToTypeEnhanced } from "../lib/EvalCasting";
import { buildDefaultFuncs } from "../lib/EvalMethods";
import { parseFieldGroups, parseFieldGroupsNested } from "../lib/InputHelpers";
import { simplifySchema } from "../lib/JSONHelpers";
import { parseNumberOrNull } from "../lib/MathHelpers";
import { createRunner } from "../lib/QuickJSUtils";
import { PRNG } from "../lib/RandHelpers";
import { renderText } from "../lib/StoryRenderMethods";
import { MockStoryServiceProvider } from "../lib/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
} from "../lib/StoryTypes";
import {
  enhanceText,
  generatePredictableKey,
  isBlank,
  LIQUID,
  parameterize,
  sha1,
  slugify,
} from "../lib/TextHelpers";
import { parseSchemaString } from "../lib/ZodHelpers";
import { expect } from "./TestUtils";

async function test() {
  // Schema parsing
  expect(simplifySchema(zodToJsonSchema(parseSchemaString("_"))), {
    type: "object",
    properties: { _: { type: "string" } },
  });
  expect(simplifySchema(zodToJsonSchema(parseSchemaString("{a:string}"))), {
    type: "object",
    properties: { a: { type: "string" } },
  });
  expect(
    simplifySchema(
      zodToJsonSchema(parseSchemaString("{foo:string, jim: number}"))
    ),
    {
      type: "object",
      properties: { foo: { type: "string" }, jim: { type: "number" } },
    }
  );
  expect(simplifySchema(zodToJsonSchema(parseSchemaString("meow"))), {
    type: "object",
    properties: { meow: { type: "string" } },
  });
  expect(simplifySchema(zodToJsonSchema(parseSchemaString("{frenchy}"))), {
    type: "object",
    properties: { frenchy: { type: "string" } },
  });

  // // Find preset voices
  expect(
    autoFindVoice(
      {
        speaker: "",
        tags: ["male", "deep", "american"],
        voice: "",
      },
      ELEVENLABS_PRESET_VOICES
    ),
    "pNInz6obpgDQGcFmaJgB"
  );
  expect(
    autoFindVoice(
      {
        speaker: "",
        tags: ["female", "young", "calm"],
        voice: "",
      },
      ELEVENLABS_PRESET_VOICES
    ),
    "LcfcDJNUP1GQjkzn1xUU"
  );
  expect(
    autoFindVoice(
      {
        speaker: "",
        tags: ["nonexistent", "tags"],
        voice: "",
      },
      ELEVENLABS_PRESET_VOICES
    ),
    "pNInz6obpgDQGcFmaJgB"
  );

  // TextHelpers tests
  expect(sha1("hello"), "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
  expect(slugify("Hello World! @#$"), "Hello_World_");
  expect(slugify("test spaces", "-"), "test-spaces");
  expect(parameterize("Hello-World_123!"), "Hello_World_123_");
  expect(isBlank(""), true);
  expect(isBlank("  "), true);
  expect(isBlank("content"), false);
  expect(isBlank([]), true);
  expect(isBlank(["item"]), false);
  expect(isBlank({}), true);
  expect(isBlank({ key: "value" }), false);
  expect(
    generatePredictableKey("test", "hello world", "txt"),
    "test/hello_world-2aae6c35.txt"
  );

  // MathHelpers tests
  expect(parseNumberOrNull("42"), 42);
  expect(parseNumberOrNull("3.14"), 3.14);
  expect(parseNumberOrNull("invalid"), null);
  expect(parseNumberOrNull(""), 0);
  expect(parseNumberOrNull("  123  "), 123);

  // castToTypeEnhanced
  expect(castToTypeEnhanced("123", "number"), 123);
  expect(castToTypeEnhanced(42, "string"), "42");
  expect(castToTypeEnhanced("true", "boolean"), true);
  expect(castToTypeEnhanced("WARRIOR", "warrior|mage|rogue"), "warrior");
  expect(castToTypeEnhanced("war", "warrior|mage|rogue"), "warrior");
  expect(castToTypeEnhanced("paladin", "warrior|mage|rogue"), null);
  expect(castToTypeEnhanced(["1", "2"], "number[]"), [1, 2]);
  expect(castToTypeEnhanced("1", "number[]"), [1]);

  // String transform
  expect(camelCase("foo-bar"), "fooBar");
  expect(camelCase("foo_bar"), "fooBar");
  expect(camelCase("FOO_BAR"), "fooBar");

  const rng = new PRNG("test");
  const scriptRunner = await createRunner();
  const funcs = buildDefaultFuncs({}, rng);
  const mockProvider = new MockStoryServiceProvider();
  const baseContext: BaseActionContext = {
    session: createDefaultSession("test"),
    rng,
    provider: mockProvider,
    scope: {},
    evaluator: async () => null,
    options: {
      verbose: false,
      seed: "test",
      loop: 0,
      ream: 100,
      doGenerateSpeech: false,
      doGenerateAudio: false,
      maxCheckpoints: 20,
      inputRetryMax: 3,
      models: DEFAULT_LLM_SLUGS,
    },
  };

  expect(
    await renderText("Hello {{name}}", {
      ...baseContext,
      scope: { name: "World" },
    }),
    "Hello World"
  );
  expect(
    await renderText("Num {{x.y}}", { ...baseContext, scope: { x: { y: 3 } } }),
    "Num 3"
  );
  expect(
    await renderText("Arr {{a.0.name}}", {
      ...baseContext,
      scope: { a: [{ name: "Z" }] },
    }),
    "Arr Z"
  );
  expect(
    await renderText("Obj {{o}}", { ...baseContext, scope: { o: { z: 1 } } }),
    'Obj {"z":1}'
  );

  // Enhancer
  const be1 = `
    here look {%
      wow
    %} for some {%great%} stuff
    we got

    {%in
    
    store%}
    for ya
    {% %}
    wow
    {% it was 10% of our earnings! %}
    yes
  `;
  const ae1 = await enhanceText(
    be1,
    async (text) => {
      return "1";
    },
    LIQUID
  );
  expect(
    ae1,
    "\n    here look 1 for some 1 stuff\n    we got\n\n    1\n    for ya\n    1\n    wow\n    1\n    yes\n  "
  );

  const f1 = parseFieldGroups({
    baba: "asdf",
    "foo.bar": "1",
  });
  expect(f1, { foo: { bar: "1" } });
  const f2 = parseFieldGroupsNested({
    baba: "asdf",
    "foo.bar": "1",
    "foo.bar.baz.bux": "222",
  });
  expect(f2, { baba: "asdf", foo: { bar: { baz: { bux: "222" } } } });
}

test();
