import { PRNG } from "../lib/RandHelpers";
import { compileStory, parseXmlFragment } from "../lib/StoryCompiler";
import { dumpTree } from "../lib/StoryNodeHelpers";
import { MockStoryServiceProvider } from "../lib/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
} from "../lib/StoryTypes";
import { expect } from "./TestUtils";

async function go() {
  const t2 = parseXmlFragment(`
  <p>yay</p>
  <sec id="foo">
    <p>hi</p>
  </sec>
  <var var="x" value="1" />
  <p>meow</p>
  <p>cow</p>
`);

  expect(
    dumpTree(t2),
    `
<root>
  <p>yay</p>
  <sec id="foo">
    <p>hi</p>
  </sec>
  <var var="x" value="1" />
  <p>meow</p>
  <p>cow</p>
</root>
`.trim()
  );

  const cartridge = {
    "abc.xml": `
    <p>hi</p>
    <p>bye</p>
  `,
    "foo.xml": `
    <p>meow</p>
    <p>ruff</p>
  `,
    "bar/baz.js": `fooBarBaz()`,
    "bar/bum/bux.js": "blahBlah()",
  };

  const p = new MockStoryServiceProvider();

  const options = {
    seed: "test-compile",
    verbose: false,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateAudio: false,
    doGenerateImage: false,
    models: DEFAULT_LLM_SLUGS,
  };

  const baseContext: BaseActionContext = {
    session: createDefaultSession("compile-test"),
    rng: new PRNG("test-compile", 0),
    provider: p,
    scope: {},
    options,
    evaluator: async () => null,
  };

  const c1 = await compileStory(baseContext, cartridge, {
    doCompileVoices: false,
  });

  expect(c1.root, {
    addr: "0",
    type: "root",
    atts: {},
    kids: [
      {
        type: "p",
        atts: {},
        kids: [
          { type: "#text", atts: {}, kids: [], text: "hi", addr: "0.0.0" },
        ],
        text: "",
        addr: "0.0",
      },
      {
        type: "p",
        atts: {},
        kids: [
          { type: "#text", atts: {}, kids: [], text: "bye", addr: "0.1.0" },
        ],
        text: "",
        addr: "0.1",
      },
      {
        type: "p",
        atts: {},
        kids: [
          { type: "#text", atts: {}, kids: [], text: "meow", addr: "0.2.0" },
        ],
        text: "",
        addr: "0.2",
      },
      {
        type: "p",
        atts: {},
        kids: [
          { type: "#text", atts: {}, kids: [], text: "ruff", addr: "0.3.0" },
        ],
        text: "",
        addr: "0.3",
      },
    ],
    text: "",
  });

  expect(c1.scripts, {
    bar: { "baz.js": "fooBarBaz()", bum: { "bux.js": "blahBlah()" } },
  });

  // (1) containers with "bare" text (no <p> etc) are possible and
  // (2) we can include that content elsewhere in the tree
  const cart2 = {
    "main.xml": `
    <div id="foo">
      hi
    </div>
    <div>
      <include id="foo" />
    </div>
  `,
  };
  const p2 = new MockStoryServiceProvider();

  const baseContext2: BaseActionContext = {
    session: createDefaultSession("compile-test-2"),
    rng: new PRNG("test-compile-2", 0),
    provider: p,
    scope: {},
    options,
    evaluator: async () => null,
  };

  const c2 = await compileStory(baseContext2, cart2, {
    doCompileVoices: false,
  });
  expect(c2.root, {
    addr: "0",
    type: "root",
    atts: {},
    kids: [
      {
        type: "div",
        atts: { id: "foo" },
        text: "",
        kids: [
          {
            type: "#text",
            atts: {},
            text: "\n      hi\n    ",
            kids: [],
            addr: "0.0.0",
          },
        ],
        addr: "0.0",
      },
      {
        type: "div",
        atts: {},
        text: "",
        kids: [
          {
            addr: "0.1.0",
            type: "#text",
            atts: {},
            text: "\n      hi\n    ",
            kids: [],
          },
        ],
        addr: "0.1",
      },
    ],
    text: "",
  });
}

go();
