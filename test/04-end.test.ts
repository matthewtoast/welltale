import { expect, runTestStory } from "./TestUtils";

async function testEnd() {
  // Test 1: Basic end tag
  {
    const xmlContent = `
<p>start</p>
<p>middle</p>
<end />
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
    console.log("✓ end tag basic test passed");
  }

  // Test 2: End tag with outro
  {
    const xmlContent = `
<p>start</p>
<p>middle</p>
<end />
<p>should not reach here</p>

<outro>
  <p>outro message</p>
</outro>
`;

    const { ops, seam } = await runTestStory(xmlContent);

    const eventOps = ops.filter((op) => op.type === "play-media");
    const textEvents = eventOps.filter((op) => op.event && op.event.body);
    const textBodies = textEvents.map((e) => e.event!.body.trim());

    expect(textBodies.length, 3);
    expect(textBodies[0], "start");
    expect(textBodies[1], "middle");
    expect(textBodies[2], "outro message");

    expect(seam, "finish");
    console.log("✓ end tag with outro test passed");
  }

  // Test 3: Conditional end
  {
    const xmlContent = `
<var name="gameOver" value="true" type="boolean" />
<p>start</p>
<if cond="gameOver">
  <p>game over</p>
  <end />
</if>
<p>should not reach here</p>
`;

    const { ops, seam } = await runTestStory(xmlContent);

    const eventOps = ops.filter((op) => op.type === "play-media");
    const textEvents = eventOps.filter((op) => op.event && op.event.body);
    const textBodies = textEvents.map((e) => e.event!.body.trim());

    expect(textBodies.length, 2);
    expect(textBodies[0], "start");
    expect(textBodies[1], "game over");

    expect(seam, "finish");
    console.log("✓ conditional end test passed");
  }

  console.log("✓ end.test.ts passed");
}

testEnd().catch(console.error);