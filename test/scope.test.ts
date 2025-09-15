import { PRNG } from "lib/RandHelpers";
import { createDefaultSession, createScope, renderText } from "lib/StoryEngine";
import { expect } from "./TestUtils";

async function go() {
  const session = createDefaultSession("test", {
    a: {
      b: {
        c: "coco",
      },
    },
    d: 2,
    e: [3],
    f: "foo",
    g: {
      h: {
        i: 3,
      },
    },
  });
  const scope = createScope(session);
  const text = await renderText(
    `hello {{f}} or {{a.b.c}} or {$ 1 + g.h.i $}`,
    { scope, rng: new PRNG("test") }
  );
  expect(text, "hello foo or coco or 4");
}

go();
