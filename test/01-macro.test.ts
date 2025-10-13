import { PRNG } from "../lib/RandHelpers";
import { compileStory } from "../lib/StoryCompiler";
import { findNodes } from "../lib/StoryNodeHelpers";
import { MockStoryServiceProvider } from "../lib/StoryServiceProvider";
import {
  CompilerContext,
  DEFAULT_LLM_SLUGS,
  StoryNode,
} from "../lib/StoryTypes";
import { createTestCartridge, expect, runTestStory } from "./TestUtils";

async function compileMacroStory(xml: string): Promise<StoryNode> {
  const cartridge = createTestCartridge(xml);
  const provider = new MockStoryServiceProvider();

  const options = {
    seed: "test-macro",
    verbose: false,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateAudio: false,
    doGenerateImage: false,
    models: DEFAULT_LLM_SLUGS,
  };

  const rng = new PRNG("test-macro", 0);
  const compilerContext: CompilerContext = {
    rng,
    provider,
    scope: {},
    options,
    evaluator: async () => null,
    ddv: { cycles: {}, bags: {} },
  };

  const result = await compileStory(compilerContext, cartridge, {
    doCompileVoices: false,
  });

  return result.root;
}

function pick(root: StoryNode, type: string): StoryNode | null {
  const found = findNodes(root, (node) => node.type === type);
  return found.length > 0 ? found[0] : null;
}

function childrenOf(node: StoryNode, type: string): StoryNode[] {
  return node.kids.filter((kid) => kid.type === type);
}

function textOf(node: StoryNode): string {
  return node.kids
    .filter((kid) => kid.type === "#text")
    .map((kid) => kid.text)
    .join("")
    .trim();
}

async function testRuntimeMacroProcessing() {
  // Test that macros are processed at runtime by running a story
  const xmlContent = `
<macro match="greeting">
  <rename to="p" />
  <set attr="from" value="HOST" />
</macro>

<greeting>Hello world</greeting>
`;

  const inputs: string[] = [];
  const { ops, seam } = await runTestStory(xmlContent, inputs);
  
  // Check that the macro was processed correctly
  const eventOps = ops.filter((op) => op.type === "play-media");
  expect(eventOps.length, 1);
  
  const event = eventOps[0].event;
  expect(event?.body.trim(), "Hello world");
  expect(event?.from, "HOST"); // This should come from the macro transformation
  expect(typeof seam, "string");
}

async function testRuntimeIncludeProcessing() {
  // Test that includes are processed at runtime by running a story
  const xmlContent = `
<div id="welcome">
  <p>Welcome message</p>
</div>

<p>Before include</p>
<include id="welcome" />
<p>After include</p>
`;

  const inputs: string[] = [];
  const { ops, seam } = await runTestStory(xmlContent, inputs);
  
  // Check that the include was processed correctly
  const eventOps = ops.filter((op) => op.type === "play-media");
  expect(eventOps.length, 4); // div content + before + included content + after
  
  const textBodies = eventOps.map(op => op.event?.body.trim());
  expect(textBodies[0], "Welcome message"); // From the div
  expect(textBodies[1], "Before include");
  expect(textBodies[2], "Welcome message"); // This should come from the included content
  expect(textBodies[3], "After include");
  expect(typeof seam, "string");
}

async function testCompileTimeBehavior() {
  // Test that the compiled tree contains untransformed nodes (compile-time behavior)
  const root = await compileMacroStory(`
<macro match="guard">
  <rename to="p" />
  <set attr="voice" value="watchman" />
</macro>

<div>
  <guard>State your business.</guard>
  <merchant>Welcome traveler</merchant>
</div>
`);

  // Original nodes should be present in compiled tree
  const guardNodes = findNodes(root, node => node.type === "guard");
  expect(guardNodes.length, 1);
  expect(textOf(guardNodes[0]), "State your business.");

  const merchantNodes = findNodes(root, node => node.type === "merchant");
  expect(merchantNodes.length, 1);
  expect(textOf(merchantNodes[0]), "Welcome traveler");

  // Macro nodes should be present
  const macroNodes = findNodes(root, node => node.type === "macro");
  expect(macroNodes.length, 1);
}

async function run() {
  await testCompileTimeBehavior();
  await testRuntimeMacroProcessing();
  await testRuntimeIncludeProcessing();
}

run()
  .then(() => {
    console.log("✓ macro.test.ts passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });