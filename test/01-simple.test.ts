import { expect, runTestStory } from "./TestUtils";

async function testSimpleStory() {
  const xmlContent = `
<p>
  Hello world
</p>

<input />

<p>
  Input was: {{input}}
</p>
`;

  const userInput = "test input";
  const { ops, seam } = await runTestStory(xmlContent, [userInput]);

  const eventOps = ops.filter((op) => op.type === "play-media");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);

  expect(textEvents.length >= 2, true);
  expect(textEvents[0].event!.body.includes("Hello world"), true);
  expect(textEvents[1].event!.body.includes("Input was: test input"), true);

  const inputOps = ops.filter((op) => op.type === "get-input");
  expect(inputOps.length, 1);

  expect(seam, "finish");

  console.log("✓ simple.test.ts passed");
}

testSimpleStory();
