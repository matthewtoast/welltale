import { autoFindPresetVoice } from "lib/ElevenLabsUtils";
import { evalExpr } from "lib/EvalUtils";
import { simplifySchema } from "lib/JSONHelpers";
import { parseNumberOrNull } from "lib/MathHelpers";
import { PRNG } from "lib/RandHelpers";
import {
  enhanceText,
  generatePredictableKey,
  isBlank,
  LIQUID,
  parameterize,
  sha1,
  slugify,
} from "lib/TextHelpers";
import { parseSchemaString } from "lib/ZodHelpers";
import { camelCase } from "lodash";
import { DEFAULT_SEED } from "test/LocalUtils";
import zodToJsonSchema from "zod-to-json-schema";
import { expect } from "./TestUtils";

const rng = new PRNG(DEFAULT_SEED);

async function test() {
  // Eval expressions
  expect(evalExpr("2 + 2", {}, {}, rng), 4);
  expect(evalExpr("2 + a", { a: 3 }, {}, rng), 5);
  expect(evalExpr("foo > 5", { foo: 4 }, {}, rng), false);
  expect(
    evalExpr(
      "foo() + a",
      { a: 3 },
      {
        foo() {
          return 7;
        },
      },
      rng
    ),
    10
  );

  const state = { a: 0 };
  evalExpr("a = 1", state, {}, rng);
  expect(state, { a: 1 });

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

  // Find preset voices
  expect(
    autoFindPresetVoice("Alice", ["female", "british"]),
    "Xb7hH8MSUJpSbSDYk0k2"
  );
  expect(
    autoFindPresetVoice("", ["male", "deep", "american"]),
    "pNInz6obpgDQGcFmaJgB"
  );
  expect(
    autoFindPresetVoice("", ["female", "young", "calm"]),
    "LcfcDJNUP1GQjkzn1xUU"
  );
  expect(
    autoFindPresetVoice("", ["nonexistent", "tags"]),
    "21m00Tcm4TlvDq8ikWAM"
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

  // String transform
  expect(camelCase("foo-bar"), "fooBar");
  expect(camelCase("foo_bar"), "fooBar");
  expect(camelCase("FOO_BAR"), "fooBar");

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
  console.log(ae1);
  // expect(
  //   ae1,
  //   "\n    here look 1 for some 1 stuff\n    we got\n\n    1\n    for ya\n    1\n    wow\n  "
  // );
}

test();
