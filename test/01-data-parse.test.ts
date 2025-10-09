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
  JSON5: a={{data.a}} b={{data.b}} c={{data.c}}
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

testDataParse();
