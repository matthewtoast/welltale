import { expect, runTestStory } from "./TestUtils";

async function testExit() {
  // Test 1: Basic exit tag (no outro)
  {
    const xmlContent = `
<p>start</p>
<p>middle</p>
<exit />
<p>should not reach here</p>
`;

    const { ops, seam } = await runTestStory(xmlContent);

    const eventOps = ops.filter((op) => op.type === "play-media");
    const textEvents = eventOps.filter((op) => op.event && op.event.body);
    const textBodies = textEvents.map((e) => e.event!.body.trim());

    expect(textBodies.length, 2);
    expect(textBodies[0], "start");
    expect(textBodies[1], "middle");

    expect(seam, "finish");
    console.log("✓ exit tag basic test passed");
  }

  // Test 2: Exit tag with outro (outro should be skipped)
  {
    const xmlContent = `
<p>start</p>
<p>middle</p>
<exit />
<p>should not reach here</p>

<outro>
  <p>outro message should not play</p>
</outro>
`;

    const { ops, seam } = await runTestStory(xmlContent);

    const eventOps = ops.filter((op) => op.type === "play-media");
    const textEvents = eventOps.filter((op) => op.event && op.event.body);
    const textBodies = textEvents.map((e) => e.event!.body.trim());

    expect(textBodies.length, 2);
    expect(textBodies[0], "start");
    expect(textBodies[1], "middle");
    // Outro should NOT play

    expect(seam, "finish");
    console.log("✓ exit tag skips outro test passed");
  }

  // Test 3: Compare exit vs end behavior
  {
    // First test with end tag (should play outro)
    const endContent = `
<p>using end tag</p>
<end />

<outro>
  <p>outro plays with end</p>
</outro>
`;

    const endResult = await runTestStory(endContent);
    const endOps = endResult.ops.filter((op) => op.type === "play-media");
    const endTexts = endOps.filter((op) => op.event && op.event.body);
    const endBodies = endTexts.map((e) => e.event!.body.trim());

    expect(endBodies.length, 2);
    expect(endBodies[1], "outro plays with end");

    // Then test with exit tag (should NOT play outro)
    const exitContent = `
<p>using exit tag</p>
<exit />

<outro>
  <p>outro skipped with exit</p>
</outro>
`;

    const exitResult = await runTestStory(exitContent);
    const exitOps = exitResult.ops.filter((op) => op.type === "play-media");
    const exitTexts = exitOps.filter((op) => op.event && op.event.body);
    const exitBodies = exitTexts.map((e) => e.event!.body.trim());

    expect(exitBodies.length, 1);
    expect(exitBodies[0], "using exit tag");
    // Outro should NOT play

    console.log("✓ exit vs end behavior test passed");
  }

  console.log("✓ exit.test.ts passed");
}

testExit();
