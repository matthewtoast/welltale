import dedent from "dedent";
import { parseTaggedSpeakerLine } from "lib/DialogHelpers";
import { autoFindPresetVoice } from "lib/ElevenLabsUtils";
import { evalExpr } from "lib/EvalUtils";
import { simplifySchema } from "lib/JSONHelpers";
import { parseNumberOrNull } from "lib/MathHelpers";
import { markdownToTree, preprocessSelfClosingTags } from "lib/NodeHelpers";
import { PRNG } from "lib/RandHelpers";
import {
  generatePredictableKey,
  isBlank,
  parameterize,
  sha1,
  slugify,
} from "lib/TextHelpers";
import { dumpTree } from "lib/TreeDumper";
import { parseSchemaString } from "lib/ZodHelpers";
import { camelCase } from "lodash";
import { DEFAULT_SEED } from "run/RunUtils";
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

  // Parse line
  expect(parseTaggedSpeakerLine("foo bar"), {
    speaker: "",
    tags: [],
    body: "foo bar",
    to: [],
  });
  expect(parseTaggedSpeakerLine("This is the narrator speaking."), {
    speaker: "",
    tags: [],
    body: "This is the narrator speaking.",
    to: [],
  });
  expect(parseTaggedSpeakerLine("#female:This is a woman."), {
    speaker: "",
    tags: ["female"],
    body: "This is a woman.",
    to: [],
  });
  expect(
    parseTaggedSpeakerLine(
      "Bob#old,male: This is [sarcastically] a guy speaking."
    ),
    {
      speaker: "Bob",
      tags: ["old", "male"],
      body: "This is [sarcastically] a guy speaking.",
      to: [],
    }
  );
  expect(parseTaggedSpeakerLine("Sarah#SomeVoiceD: I love you."), {
    speaker: "Sarah",
    tags: ["SomeVoiceD", "female"],
    body: "I love you.",
    to: [],
  });
  expect(parseTaggedSpeakerLine("Kay#EXAV123: Oh really?"), {
    speaker: "Kay",
    tags: ["EXAV123"],
    body: "Oh really?",
    to: [],
  });
  expect(parseTaggedSpeakerLine("Kay#EXAV123 (to Jim, Frank): Oh really?"), {
    speaker: "Kay",
    tags: ["EXAV123"],
    body: "Oh really?",
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

  // String transform
  expect(camelCase("foo-bar"), "fooBar");
  expect(camelCase("foo_bar"), "fooBar");
  expect(camelCase("FOO_BAR"), "fooBar");

  // preprocessSelfClosingTags tests
  expect(preprocessSelfClosingTags("<jump />"), "<jump></jump>");
  expect(preprocessSelfClosingTags("<jump/>"), "<jump></jump>");
  expect(
    preprocessSelfClosingTags('<jump to="section1" />'),
    '<jump to="section1" ></jump>'
  );
  expect(
    preprocessSelfClosingTags('<wait time="3"/>'),
    '<wait time="3"></wait>'
  );
  expect(preprocessSelfClosingTags("<br />"), "<br />");
  expect(
    preprocessSelfClosingTags('<img src="test.jpg" />'),
    '<img src="test.jpg" />'
  );
  expect(preprocessSelfClosingTags("<hr/>"), "<hr/>");
  expect(preprocessSelfClosingTags("<jump>"), "<jump></jump>");
  expect(preprocessSelfClosingTags("<input>"), "<input>"); // input without /> is not converted
  expect(preprocessSelfClosingTags("<wait>"), "<wait></wait>");
  expect(
    preprocessSelfClosingTags('<set key="value">'),
    '<set key="value"></set>'
  );
  expect(preprocessSelfClosingTags("<div>content</div>"), "<div>content</div>");
  expect(preprocessSelfClosingTags("<jump>text</jump>"), "<jump>text</jump>");
  expect(
    preprocessSelfClosingTags('<p>Hello <jump to="next" /> world</p>'),
    '<p>Hello <jump to="next" ></jump> world</p>'
  );
  expect(
    preprocessSelfClosingTags(
      '<jump />\n<wait time="5" />\n<set key="value" />'
    ),
    '<jump></jump>\n<wait time="5" ></wait>\n<set key="value" ></set>'
  );
  expect(preprocessSelfClosingTags("<div>"), "<div>");
  expect(
    preprocessSelfClosingTags('<span attr="value">'),
    '<span attr="value">'
  );
  expect(
    preprocessSelfClosingTags('<jump to="section" condition="x > 5" />'),
    '<jump to="section" condition="x > 5" />'
  );
  expect(
    preprocessSelfClosingTags('<meta charset="utf-8" />'),
    '<meta charset="utf-8" />'
  );
  expect(
    preprocessSelfClosingTags('<link rel="stylesheet" />'),
    '<link rel="stylesheet" />'
  );
  expect(
    preprocessSelfClosingTags("<jump>\n<wait>"),
    "<jump></jump>\n<wait></wait>"
  );
  expect(preprocessSelfClosingTags("<input />"), "<input />");
  expect(
    preprocessSelfClosingTags('<input type="text" />'),
    '<input type="text" />'
  );
  expect(
    preprocessSelfClosingTags('<jump to="section" condition="foo" />'),
    '<jump to="section" condition="foo" ></jump>'
  );

  // Markdown parsing
  expect(
    dumpTree(
      markdownToTree(dedent`
    # hello
    guy
    ## what up
    yo
    ### how is it
    <foo to="my friend">
  `).root
    ),
    '<root id="0">\n  <h1 id="0.0">hello</h1>\n  <text id="0.1" />\n  <p id="0.2">guy</p>\n  <text id="0.3" />\n  <h2 id="0.4">what up</h2>\n  <text id="0.5" />\n  <p id="0.6">yo</p>\n  <text id="0.7" />\n  <h3 id="0.8">how is it</h3>\n  <text id="0.9" />\n  <foo id="0.10" to="my friend" />\n</root>'
  );
}

test();
