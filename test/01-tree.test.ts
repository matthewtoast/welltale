import {
  collateText,
  findNodes,
  marshallText,
  searchForNode,
  walkTree,
} from "../lib/engine/StoryNodeHelpers";
import { MockStoryServiceProvider } from "../lib/engine/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  StoryNode,
} from "../lib/engine/StoryTypes";
import { buildDefaultFuncs } from "../lib/EvalMethods";
import { createRunner, evaluateScript } from "../lib/QuickJSUtils";
import { PRNG } from "../lib/RandHelpers";
import { expect } from "./TestUtils";

function createTestTree(): StoryNode {
  return {
    addr: "0",
    type: "root",
    atts: { id: "root-node" },
    text: "",
    kids: [
      {
        addr: "0.0",
        type: "section",
        atts: { id: "intro" },
        text: "",
        kids: [
          {
            addr: "0.0.0",
            type: "h1",
            atts: {},
            text: "Welcome",
            kids: [],
          },
          {
            addr: "0.0.1",
            type: "p",
            atts: { id: "intro-para" },
            text: "This is an introduction.",
            kids: [],
          },
        ],
      },
      {
        addr: "0.1",
        type: "section",
        atts: { id: "main-content" },
        text: "",
        kids: [
          {
            addr: "0.1.0",
            type: "h2",
            atts: {},
            text: "Main Section",
            kids: [],
          },
          {
            addr: "0.1.1",
            type: "div",
            atts: {},
            text: "",
            kids: [
              {
                addr: "0.1.1.0",
                type: "span",
                atts: {},
                text: "Nested text",
                kids: [],
              },
              {
                addr: "0.1.1.1",
                type: "b",
                atts: {},
                text: "Bold text",
                kids: [],
              },
            ],
          },
        ],
      },
      {
        addr: "0.2",
        type: "p",
        atts: { id: "footer" },
        text: "Footer content",
        kids: [],
      },
    ],
  };
}

async function test() {
  const tree = createTestTree();

  // Create a test context object
  const rng = new PRNG("test");
  const scriptRunner = await createRunner();
  const funcs = buildDefaultFuncs({}, rng);
  const mockProvider = new MockStoryServiceProvider();
  const emptySource = {
    root: { addr: "", type: "root", atts: {}, kids: [], text: "" },
    voices: {},
    pronunciations: {},
    scripts: {},
    meta: {},
  };
  const context: BaseActionContext = {
    session: createDefaultSession("test", emptySource),
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
      doGenerateAudio: false,
      doGenerateImage: false,
      maxCheckpoints: 20,
      inputRetryMax: 3,
      models: DEFAULT_LLM_SLUGS,
    },
  };

  const foundNode = walkTree(tree, (node) =>
    node.atts.id === "intro-para" ? node : null
  );
  expect(foundNode?.addr, "0.0.1");
  expect(foundNode?.type, "p");

  const firstH = walkTree(tree, (node) =>
    node.type.startsWith("h") ? node.type : null
  );
  expect(firstH, "h1");

  const nodeWithParentCheck = walkTree(tree, (node, parent) =>
    parent?.atts.id === "main-content" && node.type === "h2" ? node : null
  );
  expect(nodeWithParentCheck?.addr, "0.1.0");

  const notFound = walkTree(tree, (node) =>
    node.atts.id === "nonexistent" ? node : null
  );
  expect(notFound, null);

  const sections = findNodes(tree, (node) => node.type === "section");
  expect(sections.length, 2);
  expect(sections[0].atts.id, "intro");
  expect(sections[1].atts.id, "main-content");

  const nodesWithId = findNodes(tree, (node) => "id" in node.atts);
  expect(nodesWithId.length, 5);

  const childrenOfMainContent = findNodes(
    tree,
    (node, parent) => parent?.atts.id === "main-content"
  );
  expect(childrenOfMainContent.length, 2);
  expect(childrenOfMainContent[0].type, "h2");
  expect(childrenOfMainContent[1].type, "div");

  const noResults = findNodes(tree, () => false);
  expect(noResults.length, 0);

  const introSection = searchForNode(tree, "intro");
  expect(introSection?.node.addr, "0.0");
  expect(introSection?.node.type, "section");

  const footerNode = searchForNode(tree, "footer");
  expect(footerNode?.node.addr, "0.2");
  expect(footerNode?.node.type, "p");

  expect(searchForNode(tree, null), null);
  expect(searchForNode(tree, undefined), null);
  expect(searchForNode(tree, ""), null);
  expect(searchForNode(tree, "  "), null);

  expect(searchForNode(tree, "does-not-exist"), null);

  const allText = await marshallText(tree, context);
  expect(
    allText,
    "Welcome\nThis is an introduction.\nMain Section\nNested text\nBold text\nFooter content"
  );

  const allTextPipe = await marshallText(tree, context, " | ");
  expect(
    allTextPipe,
    "Welcome | This is an introduction. | Main Section | Nested text | Bold text | Footer content"
  );

  // Collate is like marshall except doesn't require a context to be passed in
  const mainSectionNode1 = sections[1];
  const mainSectionText1 = await collateText(mainSectionNode1);
  expect(mainSectionText1, "Main Section\nNested text\nBold text");

  const mainSectionNode = sections[1];
  const mainSectionText = await marshallText(mainSectionNode, context);
  expect(mainSectionText, "Main Section\nNested text\nBold text");

  const emptyDiv = {
    addr: "1",
    type: "div",
    atts: {},
    text: "",
    kids: [],
  };
  expect(await marshallText(emptyDiv, context), "");

  const whitespaceNode = {
    addr: "2",
    type: "p",
    atts: {},
    text: "   \n  \t  ",
    kids: [],
  };
  expect(await marshallText(whitespaceNode, context), "   \n  \t  ");

  const mixedTree: StoryNode = {
    addr: "0",
    type: "div",
    atts: {},
    text: "",
    kids: [
      {
        addr: "0.0",
        type: "script",
        atts: {},
        text: "this should not appear",
        kids: [],
      },
      {
        addr: "0.1",
        type: "p",
        atts: {},
        text: "Should appear",
        kids: [],
      },
      {
        addr: "0.2",
        type: "style",
        atts: {},
        text: ".class { color: red; }",
        kids: [],
      },
    ],
  };
  expect(await marshallText(mixedTree, context), "\nShould appear\n");
}

test();
