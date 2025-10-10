import { expect, runTestStory } from "./TestUtils";

async function testIntroResume() {
  const xmlContent = `
<intro>
  <p>-- intro --</p>
</intro>

<resume>
  <p>=== resume ===</p>
</resume>

<origin>
  <p>~ origin ~</p>
</origin>

<div>
  <p>:: div ::</p>
</div>
`;

  console.log("Test 1: First run (should show intro, then origin, then div)");
  const { ops: ops1, seam: seam1 } = await runTestStory(xmlContent);

  const eventOps1 = ops1.filter((op) => op.type === "play-media");
  const textEvents1 = eventOps1.filter((op) => op.event && op.event.body);
  const textBodies1 = textEvents1.map((e) => e.event!.body.trim());

  expect(textBodies1.length, 3);
  expect(textBodies1[0], "-- intro --");
  expect(textBodies1[1], "~ origin ~");
  expect(textBodies1[2], ":: div ::");
  expect(seam1, "finish");

  console.log(
    "Test 2: Resume without address (should show resume, then origin, then div)"
  );
  const { ops: ops2, seam: seam2 } = await runTestStory(xmlContent, [], {
    resume: true,
    turn: 1,
  });

  const eventOps2 = ops2.filter((op) => op.type === "play-media");
  const textEvents2 = eventOps2.filter((op) => op.event && op.event.body);
  const textBodies2 = textEvents2.map((e) => e.event!.body.trim());

  expect(textBodies2.length, 3);
  expect(textBodies2[0], "=== resume ===");
  expect(textBodies2[1], "~ origin ~");
  expect(textBodies2[2], ":: div ::");
  expect(seam2, "finish");

  console.log(
    "Test 3: Resume with specific address (should run resume block then jump to div)"
  );
  const { ops: ops3, seam: seam3 } = await runTestStory(xmlContent, [], {
    resume: true,
    turn: 1,
    address: "0.3",
  });

  const eventOps3 = ops3.filter((op) => op.type === "play-media");
  const textEvents3 = eventOps3.filter((op) => op.event && op.event.body);
  const textBodies3 = textEvents3.map((e) => e.event!.body.trim());

  expect(textBodies3.length, 2);
  expect(textBodies3[0], "=== resume ===");
  expect(textBodies3[1], ":: div ::");
  expect(seam3, "finish");

  console.log("Test 4: Intro should not play twice when story returns to root");
  const xmlContentWithIntroFirst = `
<intro>
  <p>Welcome to the story</p>
</intro>
<p>First content after intro</p>
<p>Second content</p>
`;

  const { ops: ops4, seam: seam4 } = await runTestStory(xmlContentWithIntroFirst);

  const eventOps4 = ops4.filter((op) => op.type === "play-media");
  const textEvents4 = eventOps4.filter((op) => op.event && op.event.body);
  const textBodies4 = textEvents4.map((e) => e.event!.body.trim());

  // Verify intro content appears exactly once
  const introCount = textBodies4.filter(text => text === "Welcome to the story").length;
  expect(introCount, 1);
  
  // Verify the expected sequence
  expect(textBodies4.length, 3);
  expect(textBodies4[0], "Welcome to the story");
  expect(textBodies4[1], "First content after intro");
  expect(textBodies4[2], "Second content");
  expect(seam4, "finish");

  console.log("✓ intro-resume.test.ts passed");
}

testIntroResume();
