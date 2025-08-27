import { parseTaggedSpeakerLine } from "lib/DialogHelpers";
import { autoFindPresetVoice } from "lib/ElevenLabsUtils";
import { evalExpr } from "lib/EvalUtils";
import { simplifySchema } from "lib/JSONHelpers";
import { parseNumberOrNull } from "lib/MathHelpers";
import { PRNG } from "lib/RandHelpers";
import { parseSchemaString } from "lib/SchemaParser";
import {
  generatePredictableKey,
  isBlank,
  parameterize,
  sha1,
  slugify,
} from "lib/TextHelpers";
import zodToJsonSchema from "zod-to-json-schema";
import { expect } from "./TestUtils";

const rng = new PRNG("test");

async function test() {
  // Eval expressions
  expect(evalExpr("2 + 2", {}, {}, rng), 4);
  expect(evalExpr("2 + a", { a: 3 }, {}, rng), 5);
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

  // Parse line
  expect(parseTaggedSpeakerLine("foo bar"), {
    speaker: "",
    tags: [],
    line: "foo bar",
    to: [],
  });
  expect(parseTaggedSpeakerLine("This is the narrator speaking."), {
    speaker: "",
    tags: [],
    line: "This is the narrator speaking.",
    to: [],
  });
  expect(parseTaggedSpeakerLine("#female:This is a woman."), {
    speaker: "",
    tags: ["female"],
    line: "This is a woman.",
    to: [],
  });
  expect(
    parseTaggedSpeakerLine(
      "Bob#old,male: This is [sarcastically] a guy speaking."
    ),
    {
      speaker: "Bob",
      tags: ["old", "male"],
      line: "This is [sarcastically] a guy speaking.",
      to: [],
    }
  );
  expect(parseTaggedSpeakerLine("Sarah#SomeVoiceD: I love you."), {
    speaker: "Sarah",
    tags: ["SomeVoiceD", "female"],
    line: "I love you.",
    to: [],
  });
  expect(parseTaggedSpeakerLine("Kay#EXAV123: Oh really?"), {
    speaker: "Kay",
    tags: ["EXAV123"],
    line: "Oh really?",
    to: [],
  });
  expect(parseTaggedSpeakerLine("Kay#EXAV123 (to Jim, Frank): Oh really?"), {
    speaker: "Kay",
    tags: ["EXAV123"],
    line: "Oh really?",
    to: ["Jim", "Frank"],
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
}

test();
