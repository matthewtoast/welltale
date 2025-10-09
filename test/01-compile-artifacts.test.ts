import { PRNG } from "../lib/RandHelpers";
import { compileStory } from "../lib/StoryCompiler";
import { findNodes } from "../lib/StoryNodeHelpers";
import { MockStoryServiceProvider } from "../lib/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
} from "../lib/StoryTypes";
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
  <voice id="town-voice" prompt="Town announcement for {{playerName}}" tags="news,urgent" />
</root>
`,
    "data.yml": `
title: Test Story
macros:
  - match: merchant
    rename:
      to: p
    set:
      attr: voice
      value: merchant
voices:
  merchant:
    name: Friendly Merchant
    prompt: Warm greeting for {{playerName}}
  herald:
    id: ready-herald
    ref: herald
    name: Herald
    tags: [news]
`,
  };

  const provider = new MockStoryServiceProvider();

  const options = {
    seed: "artifact-test",
    verbose: false,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateAudio: true,
    doGenerateImage: false,
    models: DEFAULT_LLM_SLUGS,
  };

  const context: BaseActionContext = {
    session: createDefaultSession("artifact-session"),
    rng: new PRNG("artifact-test", 0),
    provider,
    scope: { playerName: "Rin" },
    options,
    evaluator: async () => null,
  };

  const source = await compileStory(context, cartridge, {
    doCompileVoices: true,
  });

  const merchantNodes = findNodes(
    source.root,
    (node) => node.atts.voice === "merchant"
  );
  expect(merchantNodes.length, 1);
  expect(merchantNodes[0]?.type, "p");

  const guardNodes = findNodes(
    source.root,
    (node) => node.atts.voice === "watchman"
  );
  expect(guardNodes.length, 1);
  expect(guardNodes[0]?.type, "p");

  const macroNodes = findNodes(source.root, (node) => node.type === "macro");
  expect(macroNodes.length, 0);

  const compiledVoices = Object.values(source.voices);
  const dataVoice = compiledVoices.find((voice) => voice.ref === "merchant");
  expect(Boolean(dataVoice), true);
  expect(dataVoice?.name, "Friendly Merchant");

  const readyVoice = compiledVoices.find(
    (voice) => voice.id === "ready-herald"
  );
  expect(Boolean(readyVoice), true);

  const xmlVoice = compiledVoices.find((voice) => voice.ref === "town-voice");
  expect(Boolean(xmlVoice), true);
}

go();
