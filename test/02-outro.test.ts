import { expect, runTestStory } from "./TestUtils";

async function testOutro() {
  const xmlContent = `
<p>start</p>
<p>middle</p>

<outro>
  <p>end</p>
</outro>
`;

  const { ops, seam } = await runTestStory(xmlContent);

  const eventOps = ops.filter((op) => op.type === "play-media");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  const textBodies = textEvents.map((e) => e.event!.body.trim());

  expect(textBodies.length, 3);
  expect(textBodies[0], "start");
  expect(textBodies[1], "middle");
  expect(textBodies[2], "end");

  expect(seam, "finish");

  console.log("✓ outro.test.ts passed");
}

testOutro().catch(console.error);
