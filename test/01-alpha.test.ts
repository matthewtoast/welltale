import { expect, runTestStory } from "./TestUtils";

async function testBlockOrder() {
  const xmlContent = `
<var name="bee" value="boo" />
<p>
  Hello {{bee}}
</p>
<var name="x" value="12" type="number" />
<script>
  set("mum", x * 2)
</script>
<p>
  The number is {{mum}}
</p>
`;

  const inputs: string[] = [];
  const { ops, seam } = await runTestStory(xmlContent, inputs);
  const eventOps = ops.filter((op) => op.type === "play-event");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  const textBodies = textEvents.map((e) => e.event.body.trim());
  const expectedOrder = ["Hello boo", "The number is 24"];
  expect(textBodies.length, expectedOrder.length);
  for (let i = 0; i < expectedOrder.length; i++) {
    expect(textBodies[i], expectedOrder[i]);
  }
  expect(seam, "finish");
  console.log("✓ alpha.test.ts passed");
}

testBlockOrder().catch(console.error);
