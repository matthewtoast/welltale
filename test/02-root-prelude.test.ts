import { setState } from "../lib/engine/StoryConstants";
import { expect, runTestStory } from "./TestUtils";

async function testRootPrelude() {
  const xmlWithIntro = `
  <var name="greeting" value="Hello" />
  <intro>
    <p>{{greeting}} intro</p>
  </intro>
  <origin>
    <p>{{greeting}} origin</p>
  </origin>
  `;

  console.log("Test 1: Root vars should run before intro");
  const { ops: ops1, seam: seam1 } = await runTestStory(xmlWithIntro);
  const introEvents = ops1.filter((op) => op.type === "play-media");
  const introBodies = introEvents.map((op) => op.event!.body.trim());
  expect(introBodies[0], "Hello intro");
  expect(introBodies[1], "Hello origin");
  expect(seam1, "finish");

  const xmlNoIntro = `
  <var name="planet" value="Earth" />
  <origin>
    <p>{{planet}}</p>
  </origin>
  `;

  console.log("Test 2: Root vars should run before origin");
  const { ops: ops2, seam: seam2 } = await runTestStory(xmlNoIntro);
  const originEvents = ops2.filter((op) => op.type === "play-media");
  const originBodies = originEvents.map((op) => op.event!.body.trim());
  expect(originBodies[0], "Earth");
  expect(seam2, "finish");

  const state = {};
  setState(state, "a.b", 4);
  setState(state, "a.c", 6);
  expect(state, { a: { b: 4, c: 6 } });

  const xmlInputMerge = `
<p>first</p>
<input key="tl" name.type="string" />
<p>{{tl.name}}</p>
<input key="tl" foo.type="string" />
<p>{{tl.foo}}</p>
`;

  console.log(
    "Test 3: Input fields with matching key should merge into existing state"
  );
  const { session: session3, seam: seam3 } = await runTestStory(xmlInputMerge, [
    "the users name input",
    "the users foo input",
  ]);
  expect(seam3, "finish");
  expect(session3.state["tl"], {
    name: "the users name input",
    foo: "the users foo input",
  });

  console.log("✓ root-prelude.test.ts passed");
}

testRootPrelude();
