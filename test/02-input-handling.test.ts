import { expect, runTestStory } from "./TestUtils";

async function testInputHandling() {
  const xmlContent = `
<p>What's your name?</p>
<input name.type="string" name.default="Bob" />
<p>Hello {{name}}!</p>

<p>What age are you?</p>
<input age.type="number" age.default="25" />
<p>You are {{age}} years old.</p>

<p>What's your email?</p>
<input email.type="string" email.pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" email.default="user@example.com" />
<p>Your email is {{email}}.</p>

<p>What class are you?</p>
<input class.type="warrior|mage|rogue" class.default="warrior" />
<p>You are a {{class}}!</p>
`;

  console.log("Test 1: Basic input with all valid values");
  const { ops: ops1, seam: seam1 } = await runTestStory(xmlContent, [
    "Alice",
    "28",
    "alice+foo@example.com",
    "warrior",
  ]);

  const eventOps1 = ops1.filter((op) => op.type === "play-media");
  const textEvents1 = eventOps1.filter((op) => op.event && op.event.body);
  const textBodies1 = textEvents1.map((e) => e.event!.body.trim());

  expect(textBodies1.length, 8);
  expect(textBodies1[0], "What's your name?");
  expect(textBodies1[1], "Hello Alice!");
  expect(textBodies1[2], "What age are you?");
  expect(textBodies1[3], "You are 28 years old.");
  expect(textBodies1[4], "What's your email?");
  expect(textBodies1[5], "Your email is alice+foo@example.com.");
  expect(textBodies1[6], "What class are you?");
  expect(textBodies1[7], "You are a warrior!");

  expect(seam1, "finish");

  console.log("Test 2: Input with defaults (blank age, invalid email)");
  const { ops: ops2, seam: seam2 } = await runTestStory(xmlContent, [
    "Bob",
    "",
    "invalid",
    "mage",
  ]);

  const eventOps2 = ops2.filter((op) => op.type === "play-media");
  const textEvents2 = eventOps2.filter((op) => op.event && op.event.body);
  const textBodies2 = textEvents2.map((e) => e.event!.body.trim());

  expect(textBodies2[0], "What's your name?");
  expect(textBodies2[1], "Hello Bob!");
  expect(textBodies2[2], "What age are you?");
  expect(textBodies2[3], "You are 25 years old.");
  expect(textBodies2[4], "What's your email?");
  expect(textBodies2[5], "Your email is user@example.com.");
  expect(textBodies2[6], "What class are you?");
  expect(textBodies2[7], "You are a mage!");

  expect(seam2, "finish");

  console.log("Test 3: Multiple fields with LLM extraction");
  const xmlContent3 = `
  <p>Tell me your name and gender</p>
  <input playerName.description="The player's first name" playerName.default="Blake" playerGender.description="The player's gender" playerGender.type="man|woman" playerGender.default="man" />
  <p>Hello {{playerName}}, you are a {{playerGender}}!</p>
  `;

  const { ops: ops3, seam: seam3 } = await runTestStory(xmlContent3, [
    "matt, man",
  ]);

  const eventOps3 = ops3.filter((op) => op.type === "play-media");
  const textEvents3 = eventOps3.filter((op) => op.event && op.event.body);
  const textBodies3 = textEvents3.map((e) => e.event!.body.trim());

  expect(textBodies3.length, 2);
  expect(textBodies3[0], "Tell me your name and gender");
  expect(textBodies3[1], "Hello Mock playerName, you are a Mock playerGender!");

  expect(seam3, "finish");

  console.log("✓ input-handling.test.ts passed");
}

testInputHandling();
