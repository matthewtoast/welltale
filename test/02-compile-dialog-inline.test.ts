import { PRNG } from "../lib/RandHelpers";
import { compileStory } from "../lib/StoryCompiler";
import { MockStoryServiceProvider } from "../lib/StoryServiceProvider";
import {
  CompilerContext,
  DEFAULT_LLM_SLUGS,
  StoryNode,
} from "../lib/StoryTypes";
import { expect } from "./TestUtils";

function hasType(node: StoryNode, type: string): boolean {
  if (node.type === type) {
    return true;
  }
  for (const kid of node.kids) {
    if (hasType(kid, type)) {
      return true;
    }
  }
  return false;
}

async function testDialogInlineCompile() {
  const provider = new MockStoryServiceProvider();
  const rng = new PRNG("compile-dialog-inline", 0);
  const context: CompilerContext = {
    provider,
    rng,
    scope: {},
    options: { models: DEFAULT_LLM_SLUGS },
    evaluator: async () => null,
    ddv: { cycles: {}, bags: {} },
  };
  const cartridge = {
    "main.wsl": `
<while cond="true">
  <input key="input" from="player" />

  <llm:line as="Bill" with="player" key="reply">
    You are Bill, an angry corn farmer. You're grumpy, but you really love corn.
    You get angry when the conversation turns to topics other than corn.
    You get happier the more your conversation partner talks about corn.
    Try to use corn-related metaphors as much as possible.
  </llm:line>

  <p from="Bill">{{reply}}</p>

  <llm:score
    key="analysis"
    sentiment="sentiment score, value between -1.0..1.0">
    {{reply}}
  </llm:score>

  <if cond="analysis.sentiment > 0.9">
    <break />
  </if>
</while>

<p from="Bill">
  I can see that you love corn. And I love you.
</p>
`,
  };
  const sources = await compileStory(context, cartridge, {
    doCompileVoices: false,
    doGenerateThumbnails: true,
  });
  expect(sources.root.type, "root");
  expect(hasType(sources.root, "while"), true);
  expect(hasType(sources.root, "input"), true);
  expect(hasType(sources.root, "llm:line"), true);
  expect(hasType(sources.root, "llm:score"), true);
  expect(hasType(sources.root, "p"), true);
}

testDialogInlineCompile();
