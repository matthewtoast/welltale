import { compileStory, parseXmlFragment } from "lib/StoryCompiler";
import { PRNG } from "lib/RandHelpers";
import { DEFAULT_LLM_SLUGS } from "lib/StoryTypes";
import { dumpTree } from "lib/StoryNodeHelpers";
import { MockStoryServiceProvider } from "lib/StoryServiceProvider";
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
  };

  const p = new MockStoryServiceProvider();
  const opts = {
    verbose: false,
    seed: "seed",
    loop: 0,
    ream: 100,
    doGenerateSpeech: false,
    doGenerateAudio: false,
    maxCheckpoints: 20,
    models: DEFAULT_LLM_SLUGS,
  };
  const rng = new PRNG(opts.seed);
  const ctx = { rng, provider: p, scope: {}, options: opts };

  const c1 = await compileStory(ctx, cartridge, {
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
}

go();
