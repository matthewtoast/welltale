import { PRNG } from "../lib/RandHelpers";
import { compileStory } from "../lib/StoryCompiler";
import { MockStoryServiceProvider } from "../lib/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  StoryNode,
} from "../lib/StoryTypes";
import { createTestCartridge, expect } from "./TestUtils";

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
    models: DEFAULT_LLM_SLUGS,
  };

  const baseContext: BaseActionContext = {
    session: createDefaultSession("macro-test"),
    rng: new PRNG("test-macro", 0),
    provider,
    scope: {},
    options,
    evaluator: async () => null,
  };

  const compiled = await compileStory(baseContext, cartridge, {
    doCompileVoices: false,
  });
  return compiled.root;
}

function pick(node: StoryNode, tag: string): StoryNode | null {
  return node.kids.find((kid) => kid.type === tag) ?? null;
}

function childrenOf(node: StoryNode, tag: string): StoryNode[] {
  return node.kids.filter((kid) => kid.type === tag);
}

function textOf(node: StoryNode): string {
  return node.kids
    .filter((kid) => kid.type === "#text")
    .map((kid) => kid.text)
    .join("")
    .trim();
}

async function testMacroSetAndRename() {
  const root = await compileMacroStory(`
<macro match="p[role=host]">
  <set attr="from" value="HOST" />
  <remove attr="role" />
</macro>

<macro match="note">
  <rename to="p" />
  <set attr="from" value="NOTE" />
</macro>

<sec>
  <p role="host">Hello</p>
  <note>Remember this</note>
</sec>
`);

  const sec = pick(root, "sec");
  if (!sec) {
    throw new Error("missing sec node");
  }
  const paragraphs = childrenOf(sec, "p");
  expect(paragraphs.length, 2);
  expect(paragraphs[0].atts.from, "HOST");
  expect("role" in paragraphs[0].atts, false);
  expect(textOf(paragraphs[0]), "Hello");
  expect(paragraphs[1].atts.from, "NOTE");
  expect(textOf(paragraphs[1]), "Remember this");
}

async function testMacroAppendPrependReplace() {
  const root = await compileMacroStory(`
<macro match="sec">
  <prepend>
    <p from="HEAD">head</p>
  </prepend>
  <append>
    <p from="TAIL">tail</p>
  </append>
</macro>

<macro match="note">
  <replace>
    <p from="REP">replaced</p>
  </replace>
</macro>

<sec>
  <p>Main</p>
  <note>Old</note>
</sec>
`);

  const sec = pick(root, "sec");
  if (!sec) {
    throw new Error("missing sec node");
  }
  const paragraphs = childrenOf(sec, "p");
  const froms = paragraphs.map((p) => p.atts.from ?? "");
  expect(froms, ["HEAD", "", "REP", "TAIL"]);
  const texts = paragraphs.map((p) => textOf(p));
  expect(texts, ["head", "Main", "replaced", "tail"]);
}

async function run() {
  await testMacroSetAndRename();
  await testMacroAppendPrependReplace();
}

run();
