import { buildDefaultFuncs } from "../lib/EvalMethods";
import { createRunner, evaluateScript } from "../lib/QuickJSUtils";
import { PRNG } from "../lib/RandHelpers";
import { BaseActionContext } from "../lib/StoryEngine";
import { extractInput } from "../lib/StoryInput";
import { MockStoryServiceProvider } from "../lib/StoryServiceProvider";
import { createDefaultSession, DEFAULT_LLM_SLUGS } from "../lib/StoryTypes";
import { expect } from "./TestUtils";

async function test() {
  const rng = new PRNG("test");
  const scriptRunner = await createRunner();
  const funcs = buildDefaultFuncs({}, rng);
  const mockProvider = new MockStoryServiceProvider();
  const baseContext: BaseActionContext = {
    session: createDefaultSession("test"),
    rng,
    provider: mockProvider,
    scope: {},
    evaluator: async (expr, scope) => {
      return await evaluateScript(expr, scope, funcs, scriptRunner);
    },
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

  expect(await extractInput("Bob", { input: "Bob" }, baseContext), {});

  expect(await extractInput("Bob", { key: "name" }, baseContext), {
    name: "Bob",
  });

  expect(await extractInput("Bob", { "name.type": "string" }, baseContext), {
    name: "Bob",
  });

  expect(await extractInput("42", { "age.type": "number" }, baseContext), {
    age: 42,
  });

  expect(
    await extractInput("true", { "active.type": "boolean" }, baseContext),
    { active: true }
  );

  expect(
    await extractInput(
      "",
      { "name.type": "string", "name.default": "Anonymous" },
      baseContext
    ),
    { name: "Anonymous" }
  );

  expect(
    await extractInput(
      "   ",
      { "name.type": "string", "name.default": "Anonymous" },
      baseContext
    ),
    { name: "Anonymous" }
  );

  expect(await extractInput("", { "code.type": "string" }, baseContext), {
    code: "",
  });

  expect(
    await extractInput(
      "Bob",
      { "name.type": "string", "name.pattern": "[A-Za-z]+" },
      baseContext
    ),
    { name: "Bob" }
  );

  expect(
    await extractInput(
      "123",
      {
        "name.type": "string",
        "name.pattern": "[A-Za-z]+",
        "name.default": "Invalid",
      },
      baseContext
    ),
    { name: "Invalid" }
  );

  expect(
    await extractInput(
      "Bob, 25",
      { "name.type": "string", "age.type": "number" },
      baseContext
    ),
    { name: "Mock name", age: "Mock age" } // MockStoryServiceProvider returns proper object with field names
  );

  expect(
    await extractInput(
      "Bob",
      { "name.type": "string", "name.description": "the user's first name" },
      baseContext
    ),
    { name: "Mock name" }
  );

  expect(
    await extractInput(
      "warrior",
      { "class.type": "string", "class.enum": "warrior|mage|rogue" },
      baseContext
    ),
    { class: "warrior" } // Now handles enum locally
  );

  expect(
    await extractInput(
      "25",
      { "age.type": "number", "age.range": "18..65" },
      baseContext
    ),
    { age: "Mock age" }
  );

  expect(
    await extractInput(
      "baseball, tennis",
      { "hobbies.type": "array<string>" },
      baseContext
    ),
    { hobbies: "Mock hobbies" }
  );

  expect(
    await extractInput("some data", { "data.type": "object" }, baseContext),
    { data: "Mock data" }
  );

  const contextWithScope = {
    ...baseContext,
    scope: { multiplier: 2 },
  };
  expect(
    await extractInput(
      "5",
      { "result.type": "number", "result.parse": "input * multiplier" },
      contextWithScope
    ),
    { result: 10 }
  );

  expect(
    await extractInput("data", { "items.type": "Array<String>" }, baseContext),
    { items: "Mock items" }
  );

  expect(
    await extractInput("data", { "items.type": "STRING[]" }, baseContext),
    { items: "Mock items" }
  );

  expect(await extractInput("test", { "value.type": "STRING" }, baseContext), {
    value: "test",
  });
  expect(await extractInput("42", { "value.type": "NUMBER" }, baseContext), {
    value: 42,
  });
  expect(await extractInput("true", { "value.type": "BOOLEAN" }, baseContext), {
    value: true,
  });

  // Test enum parsing - exact match
  expect(
    await extractInput(
      "warrior",
      { "class.enum": "warrior|mage|rogue" },
      baseContext
    ),
    {
      class: "warrior",
    }
  );

  // Test enum parsing - case insensitive
  expect(
    await extractInput(
      "MAGE",
      { "class.enum": "warrior|mage|rogue" },
      baseContext
    ),
    {
      class: "mage",
    }
  );

  // Test enum parsing - partial match
  expect(
    await extractInput(
      "war",
      { "class.enum": "warrior|mage|rogue" },
      baseContext
    ),
    {
      class: "warrior",
    }
  );

  // Test enum parsing via type field
  expect(
    await extractInput(
      "rogue",
      { "class.type": "warrior|mage|rogue" },
      baseContext
    ),
    {
      class: "rogue",
    }
  );

  // Test enum parsing failure - should fall back to LLM
  expect(
    await extractInput(
      "paladin",
      { "class.enum": "warrior|mage|rogue" },
      baseContext
    ),
    {
      class: "Mock class",
    }
  );

  // Test enum with range - should use LLM (complex validation)
  expect(
    await extractInput(
      "warrior",
      { "class.enum": "warrior|mage|rogue", "class.range": "1..3" },
      baseContext
    ),
    {
      class: "Mock class",
    }
  );
}

test();
