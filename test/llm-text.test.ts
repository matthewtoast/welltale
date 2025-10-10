import { expect, runTestStory } from "./TestUtils";

async function testLLMText() {
  const xmlContent = `
<llm:text key="greeting">
  Write a friendly greeting message.
</llm:text>

<p>AI says: {{greeting}}</p>

<llm:text key="story" web="false">
  Write a one-sentence story about a cat.
</llm:text>

<p>Story: {{story}}</p>
`;

  console.log("Test: llm:text tag generates text and stores it in variables");
  const { ops, seam, session } = await runTestStory(xmlContent);

  // Check that the llm:text tags created the expected variables
  expect(typeof session.state.greeting, "string");
  expect(typeof session.state.story, "string");
  
  // Check that the generated text was used in the output
  const eventOps = ops.filter((op) => op.type === "play-media");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  
  expect(textEvents.length, 2);
  
  // First output should include the greeting
  expect(textEvents[0].event!.body.includes("AI says:"), true);
  expect(textEvents[0].event!.body.includes("Mock completion"), true); // In test mode, we get mock responses
  
  // Second output should include the story
  expect(textEvents[1].event!.body.includes("Story:"), true);
  expect(textEvents[1].event!.body.includes("Mock completion"), true);
  
  expect(seam, "finish");

  console.log("✓ llm-text.test.ts passed");
}

testLLMText();