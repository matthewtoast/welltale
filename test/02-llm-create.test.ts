import { expect, runTestStory } from "./TestUtils";
import type { OP } from "../lib/StoryTypes";

async function testLLMCreate() {
  const xml = `
<p>Before</p>
<llm:create>
  Write a short WSL passage with one paragraph about an ancient tree.
</llm:create>
<p>After</p>
`;

  const { ops, seam } = await runTestStory(xml);
  const textOps = ops.filter(
    (op): op is Extract<OP, { type: "play-media" }> =>
      op.type === "play-media"
  );
  const bodies = textOps
    .map((op) => op.event?.body?.trim())
    .filter((body): body is string => !!body);

  expect(bodies.length, 3);
  expect(bodies[0], "Before");
  expect(bodies[1], "Mock generated story");
  expect(bodies[2], "After");
  expect(seam, "finish");

  console.log("✓ llm-create.test.ts passed");
}

testLLMCreate();
