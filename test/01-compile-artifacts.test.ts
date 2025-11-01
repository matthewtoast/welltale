import { compileStory } from "../lib/engine/StoryCompiler";
import { findNodes } from "../lib/engine/StoryNodeHelpers";
import { MockStoryServiceProvider } from "../lib/engine/StoryServiceProvider";
import { CompilerContext, DEFAULT_LLM_SLUGS } from "../lib/engine/StoryTypes";
import { PRNG } from "../lib/RandHelpers";
import { expect } from "./TestUtils";

async function go() {
  const cartridge = {
    "main.xml": `
<root>
  <macro match="guard">
    <rename to="p" />
    <set attr="voice" value="watchman" />
  </macro>
  <merchant>Welcome {{playerName}}</merchant>
  <guard>State your business.</guard>
</root>
`,
    "data.yml": `
title: Test Story
voices:
  merchant:
    name: Friendly Merchant
    prompt: Warm greeting for {{playerName}}
  herald:
    id: ready-herald
    ref: herald
    name: Herald
    tags: [news]
  town-voice:
    prompt: Town announcement for {{playerName}}
    tags: [news, urgent]
`,
  };

  const provider = new MockStoryServiceProvider();

  const options = {
    seed: "artifact-test",
    verbose: false,
    ream: 100,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateAudio: true,
    doGenerateImage: false,
    models: DEFAULT_LLM_SLUGS,
  };

  const context: CompilerContext = {
    rng: new PRNG("artifact-test", 0),
    provider,
    locals: { playerName: "Rin" },
    options: { models: options.models },
    evaluator: async () => null,
    ddv: { cycles: {}, bags: {} },
  };

  const source = await compileStory(context, cartridge, {
    doCompileVoices: true,
    doGenerateThumbnails: true,
  });

  // With runtime processing, original nodes should remain untransformed in compiled tree
  const merchantNodes = findNodes(
    source.root,
    (node) => node.type === "merchant"
  );
  expect(merchantNodes.length, 1);

  const guardNodes = findNodes(source.root, (node) => node.type === "guard");
  expect(guardNodes.length, 1);

  // Only XML macro nodes should be present in compiled tree (data macros are stored separately)
  const macroNodes = findNodes(source.root, (node) => node.type === "macro");
  expect(macroNodes.length, 1); // One from XML

  const compiledVoices = Object.values(source.voices);
  const dataVoice = compiledVoices.find((voice) => voice.ref === "merchant");
  expect(Boolean(dataVoice), true);
  expect(dataVoice?.name, "Friendly Merchant");

  const readyVoice = compiledVoices.find(
    (voice) => voice.id === "ready-herald"
  );
  expect(Boolean(readyVoice), true);

  const townVoice = compiledVoices.find((voice) => voice.ref === "town-voice");
  expect(Boolean(townVoice), true);
  expect(townVoice?.tags?.includes("news"), true);
  expect(townVoice?.tags?.includes("urgent"), true);
}

go();
