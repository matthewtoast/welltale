import { processIncludes } from "./../lib/StoryCompiler";
import { StoryNode } from "./../lib/StoryTypes";
import { expect } from "./TestUtils";

async function test() {
  // Test 1: should replace include nodes with module content
  {
    const root: StoryNode = {
      type: "root",
      addr: "0",
      atts: {},
      kids: [
        {
          type: "module",
          addr: "0.0",
          atts: { id: "test-module" },
          kids: [
            {
              type: "p",
              addr: "0.0.0",
              atts: {},
              kids: [],
              text: "Module content 1",
            },
            {
              type: "p",
              addr: "0.0.1",
              atts: {},
              kids: [],
              text: "Module content 2",
            },
          ],
          text: "",
        },
        {
          type: "sec",
          addr: "0.1",
          atts: {},
          kids: [
            {
              type: "p",
              addr: "0.1.0",
              atts: {},
              kids: [],
              text: "Before include",
            },
            {
              type: "include",
              addr: "0.1.1",
              atts: { id: "test-module" },
              kids: [],
              text: "",
            },
            {
              type: "p",
              addr: "0.1.2",
              atts: {},
              kids: [],
              text: "After include",
            },
          ],
          text: "",
        },
      ],
      text: "",
    };

    processIncludes(root);

    const sec = root.kids[1];
    expect(sec.kids.length, 4);
    expect(sec.kids[0].text, "Before include");
    expect(sec.kids[1].type, "p");
    expect(sec.kids[1].text, "Module content 1");
    expect(sec.kids[2].type, "p");
    expect(sec.kids[2].text, "Module content 2");
    expect(sec.kids[3].text, "After include");
  }

  // Test 2: should handle multiple includes of the same module
  {
    const root: StoryNode = {
      type: "root",
      addr: "0",
      atts: {},
      kids: [
        {
          type: "module",
          addr: "0.0",
          atts: { id: "reusable" },
          kids: [
            {
              type: "p",
              addr: "0.0.0",
              atts: {},
              kids: [],
              text: "Reusable content",
            },
          ],
          text: "",
        },
        {
          type: "sec",
          addr: "0.1",
          atts: {},
          kids: [
            {
              type: "include",
              addr: "0.1.0",
              atts: { id: "reusable" },
              kids: [],
              text: "",
            },
            {
              type: "include",
              addr: "0.1.1",
              atts: { id: "reusable" },
              kids: [],
              text: "",
            },
          ],
          text: "",
        },
      ],
      text: "",
    };

    processIncludes(root);

    const sec = root.kids[1];
    expect(sec.kids.length, 2);
    expect(sec.kids[0].type, "p");
    expect(sec.kids[0].text, "Reusable content");
    expect(sec.kids[1].type, "p");
    expect(sec.kids[1].text, "Reusable content");
  }

  // Test 3: should handle include with non-existent module
  {
    const root: StoryNode = {
      type: "root",
      addr: "0",
      atts: {},
      kids: [
        {
          type: "module",
          addr: "0.0",
          atts: { id: "existing-module" },
          kids: [
            {
              type: "p",
              addr: "0.0.0",
              atts: {},
              kids: [],
              text: "Existing module content",
            },
          ],
          text: "",
        },
        {
          type: "sec",
          addr: "0.1",
          atts: {},
          kids: [
            {
              type: "p",
              addr: "0.1.0",
              atts: {},
              kids: [],
              text: "Before",
            },
            {
              type: "include",
              addr: "0.1.1",
              atts: { id: "non-existent" },
              kids: [],
              text: "",
            },
            {
              type: "p",
              addr: "0.1.2",
              atts: {},
              kids: [],
              text: "After",
            },
          ],
          text: "",
        },
      ],
      text: "",
    };

    processIncludes(root);

    const sec = root.kids[1];
    expect(sec.kids.length, 2);
    expect(sec.kids[0].text, "Before");
    expect(sec.kids[1].text, "After");
  }

  // Test 4: should handle nested module content
  {
    const root: StoryNode = {
      type: "root",
      addr: "0",
      atts: {},
      kids: [
        {
          type: "module",
          addr: "0.0",
          atts: { id: "nested" },
          kids: [
            {
              type: "sec",
              addr: "0.0.0",
              atts: {},
              kids: [
                {
                  type: "p",
                  addr: "0.0.0.0",
                  atts: {},
                  kids: [],
                  text: "Nested content",
                },
              ],
              text: "",
            },
          ],
          text: "",
        },
        {
          type: "sec",
          addr: "0.1",
          atts: {},
          kids: [
            {
              type: "include",
              addr: "0.1.0",
              atts: { id: "nested" },
              kids: [],
              text: "",
            },
          ],
          text: "",
        },
      ],
      text: "",
    };

    processIncludes(root);

    const sec = root.kids[1];
    expect(sec.kids.length, 1);
    expect(sec.kids[0].type, "sec");
    expect(sec.kids[0].kids[0].type, "p");
    expect(sec.kids[0].kids[0].text, "Nested content");
  }

  // Test 5: should ignore includes without id
  {
    const root: StoryNode = {
      type: "root",
      addr: "0",
      atts: {},
      kids: [
        {
          type: "module",
          addr: "0.0",
          atts: { id: "test" },
          kids: [
            {
              type: "p",
              addr: "0.0.0",
              atts: {},
              kids: [],
              text: "Content",
            },
          ],
          text: "",
        },
        {
          type: "sec",
          addr: "0.1",
          atts: {},
          kids: [
            {
              type: "include",
              addr: "0.1.0",
              atts: {},
              kids: [],
              text: "",
            },
          ],
          text: "",
        },
      ],
      text: "",
    };

    processIncludes(root);

    const sec = root.kids[1];
    expect(sec.kids.length, 1);
    expect(sec.kids[0].type, "include");
  }

  // Test 6: should ignore modules without id
  {
    const root: StoryNode = {
      type: "root",
      addr: "0",
      atts: {},
      kids: [
        {
          type: "module",
          addr: "0.0",
          atts: {},
          kids: [
            {
              type: "p",
              addr: "0.0.0",
              atts: {},
              kids: [],
              text: "Content",
            },
          ],
          text: "",
        },
        {
          type: "sec",
          addr: "0.1",
          atts: {},
          kids: [
            {
              type: "include",
              addr: "0.1.0",
              atts: { id: "test" },
              kids: [],
              text: "",
            },
          ],
          text: "",
        },
      ],
      text: "",
    };

    processIncludes(root);

    const sec = root.kids[1];
    expect(sec.kids.length, 1);
    expect(sec.kids[0].type, "include");
  }
}

test();
