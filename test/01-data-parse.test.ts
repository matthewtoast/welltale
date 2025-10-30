import { expect, runTestStory } from "./TestUtils";

async function testDataParse() {
  const xmlContent = `
<p>
  Start
</p>

<data format="json">
  // JSON5 with comments and trailing commas
  {
    a: 1,
    b: 2,
    c: 'hi',
  }
</data>

<p>
  JSON5: a={{_.a}} b={{_.b}} c={{_.c}}
</p>

<data format="yaml" key="y">
  name: Alice
  nums: four-five
  nested:
    k: v
</data>

<p>
  YAML: name={{y.name}} nums={{y.nums}} nk={{y.nested.k}}
</p>

<p>
  Done
</p>
`;

  const { ops, seam } = await runTestStory(xmlContent);

  const eventOps = ops.filter((op) => op.type === "play-media");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  const textBodies = textEvents
    .filter((e) => e.event)
    .map((e) => e.event!.body.trim());

  expect(textBodies.length, 4);
  expect(textBodies[0], "Start");
  expect(textBodies[1], "JSON5: a=1 b=2 c=hi");
  expect(textBodies[2], "YAML: name=Alice nums=four-five nk=v");
  expect(textBodies[3], "Done");

  expect(seam, "finish");

  console.log("✓ data-parse.test.ts passed");
}

async function testFrontmatterParse() {
  const xmlContent = `---
title: Test Story
version: 1.0
settings:
  voice: narrator
  music: true
---
<p>
  Title is: {{title}}
</p>
<p>
  Version is: {{version}}
</p>
<p>
  Voice is: {{settings.voice}}
</p>
<p>
  Music enabled: {{settings.music}}
</p>
---
extra: data
count: 42
---
<p>
  Extra: {{extra}}, Count: {{count}}
</p>
`;

  const { ops, seam } = await runTestStory(xmlContent);

  const eventOps = ops.filter((op) => op.type === "play-media");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  const textBodies = textEvents
    .filter((e) => e.event)
    .map((e) => e.event!.body.trim());

  expect(textBodies.length, 5);
  expect(textBodies[0], "Title is: Test Story");
  expect(textBodies[1], "Version is: 1");
  expect(textBodies[2], "Voice is: narrator");
  expect(textBodies[3], "Music enabled: true");
  expect(textBodies[4], "Extra: data, Count: 42");

  expect(seam, "finish");

  console.log("✓ frontmatter-parse test passed");
}

async function testMixedDataAndFrontmatter() {
  const cartridge = {
    "main.xml": `---
globalVar: from-frontmatter
---
<p>
  Global var: {{globalVar}}
</p>
<data format="json">
  {
    localVar: "from-data-tag"
  }
</data>
<p>
  Local var: {{_.localVar}}
</p>`,
    "extra.xml": `---
extraVar: 123
---
<p>
  Extra var from other file: {{extraVar}}
</p>`
  };

  const { ops, seam } = await runTestStory(cartridge);

  const eventOps = ops.filter((op) => op.type === "play-media");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  const textBodies = textEvents
    .filter((e) => e.event)
    .map((e) => e.event!.body.trim());

  expect(textBodies.length, 3);
  expect(textBodies[0], "Global var: from-frontmatter");
  expect(textBodies[1], "Local var: from-data-tag");
  expect(textBodies[2], "Extra var from other file: 123");

  expect(seam, "finish");

  console.log("✓ mixed data and frontmatter test passed");
}

async function runAllTests() {
  await testDataParse();
  await testFrontmatterParse();
  await testMixedDataAndFrontmatter();
}

runAllTests();
