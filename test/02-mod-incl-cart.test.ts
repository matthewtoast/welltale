import { expect, runTestStory } from "./TestUtils";

async function testModuleInclude() {
  const xmlContent = `
<module id="greeting">
  <p>Hello from module!</p>
</module>

<p>Start</p>
<include id="greeting" />
<p>End</p>
`;

  const { ops, seam } = await runTestStory(xmlContent);

  const eventOps = ops.filter((op) => op.type === "play-event");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  const textBodies = textEvents.map((e) => e.event.body.trim());

  expect(textBodies.length, 3);
  expect(textBodies[0], "Start");
  expect(textBodies[1], "Hello from module!");
  expect(textBodies[2], "End");

  expect(seam, "finish");

  console.log("✓ mod-incl-cart.test.ts passed");
}

testModuleInclude().catch(console.error);
