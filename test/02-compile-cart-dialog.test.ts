import { join } from "path";
import { loadDirRecursive } from "../lib/FileUtils";
import { PRNG } from "../lib/RandHelpers";
import { compileStory } from "../lib/StoryCompiler";
import { MockStoryServiceProvider } from "../lib/StoryServiceProvider";
import {
  CompilerContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  StoryNode,
} from "../lib/StoryTypes";
import { expect } from "./TestUtils";

function nodeHasType(root: StoryNode, type: string): boolean {
  if (root.type === type) {
    return true;
  }
  return root.kids.some((child) => nodeHasType(child, type));
}

async function testDialogCompile() {
  const provider = new MockStoryServiceProvider();
  const rng = new PRNG("compile-dialog", 0);
  const context: CompilerContext = {
    provider,
    rng,
    scope: {},
    options: { models: DEFAULT_LLM_SLUGS },
    evaluator: async () => null,
    ddv: { cycles: {}, bags: {} },
  };
  const fixtureDir = join(__dirname, "../fic/dialog");
  const cartridge = await loadDirRecursive(fixtureDir);
  const sources = await compileStory(context, cartridge, {
    doCompileVoices: false,
  });
  const session = createDefaultSession("dialog", sources);

  expect(session.root.kids.length > 0, true);
  expect(nodeHasType(session.root, "example-a"), true);
  expect(nodeHasType(session.root, "example-b"), true);
  expect(nodeHasType(session.root, "llm:line"), true);

  console.info("✓ dialog cartridge compiles with llm:line present");
}

testDialogCompile();
