import {} from "lib/StoryEngine";
import {
  findNodes,
  marshallText,
  searchForNode,
  walkTree,
} from "lib/StoryNodeHelpers";
import { StoryNode } from "lib/StoryTypes";
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

  const allText = await marshallText(tree, {});
  expect(
    allText,
    "Welcome\nThis is an introduction.\nMain Section\nNested text\nBold text\nFooter content"
  );

  const allTextPipe = await marshallText(tree, {}, " | ");
  expect(
    allTextPipe,
    "Welcome | This is an introduction. | Main Section | Nested text | Bold text | Footer content"
  );

  const mainSectionNode = sections[1];
  const mainSectionText = await marshallText(mainSectionNode, {});
  expect(mainSectionText, "Main Section\nNested text\nBold text");

  const emptyDiv = {
    addr: "1",
    type: "div",
    atts: {},
    text: "",
    kids: [],
  };
  expect(await marshallText(emptyDiv, {}), "");

  const whitespaceNode = {
    addr: "2",
    type: "p",
    atts: {},
    text: "   \n  \t  ",
    kids: [],
  };
  expect(await marshallText(whitespaceNode, {}), "");

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
  expect(await marshallText(mixedTree, {}), "Should appear");
}

test();
