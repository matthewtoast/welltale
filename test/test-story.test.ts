import { readFileSync } from "fs";
import { join } from "path";
import { expect, runTestStory } from "./TestUtils";

async function testTestStory() {
  // Load the simple test story from fic/test
  const ficPath = join(__dirname, "../fic/test");
  const cartridge = {
    "main.xml": readFileSync(join(ficPath, "main.xml"), "utf-8"),
    "data.yml": readFileSync(join(ficPath, "data.yml"), "utf-8"),
  };

  // Define inputs for the test story:
  // 1. Response to "What do you think?"
  // 2-5. Inputs for the while loop (until we say "exit")
  const inputs = [
    "I think this is interesting!", // Response to first input
    "hello", // While loop iteration 1
    "world", // While loop iteration 2
    "testing", // While loop iteration 3
    "exit", // Exit the while loop
  ];
  const expectedInputCount = inputs.length;

  const { ops, seam, session } = await runTestStory(cartridge, inputs);

  // Filter for text content events
  const eventOps = ops.filter((op) => op.type === "play-media");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  const textBodies = textEvents.map((e) => e.event!.body.trim());

  // Verify key story elements
  const expectedContent = [
    // Metadata interpolation
    /You're playing Test, by Matthew Trost/,
    // Expression evaluation
    /It's 2001\. What do you think/,
    // Input capture and display
    /You said I think this is interesting/,
    // While loop exit
    /After while loop/,
  ];

  // Verify expected content appears
  let contentIndex = 0;
  for (let i = 0; i < expectedContent.length; i++) {
    const pattern = expectedContent[i];
    let found = false;

    for (let j = contentIndex; j < textBodies.length; j++) {
      if (pattern.test(textBodies[j])) {
        contentIndex = j + 1;
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(`Missing expected story content: ${pattern.source}`);
    }
  }

  // Verify session state
  // Note: input gets overwritten by the while loop, so it will be the last input
  expect(session.state.input, "exit");
  expect(session.state.stuff, "exit");
  expect(typeof session.state.time, "number");

  // Verify story completed successfully
  expect(seam, "finish");

  // Count operation types
  const playMediaOps = ops.filter((op) => op.type === "play-media").length;
  const getInputOps = ops.filter((op) => op.type === "get-input").length;
  const sleepOps = ops.filter((op) => op.type === "sleep").length;
  const storyEndOps = ops.filter((op) => op.type === "story-end").length;

  // Basic sanity checks
  expect(getInputOps, expectedInputCount); // Should match our input count
  expect(sleepOps, 1); // Should have sleep operation
  expect(playMediaOps, 4); // Should have exactly 4 text events
  expect(storyEndOps, 1); // Should end the story

  console.log("✓ Test story completed successfully!");
}

testTestStory().catch(console.error);
