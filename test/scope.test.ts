import { PRNG } from "lib/RandHelpers";
import {
  createDefaultPlaythru,
  createScope,
  renderText,
} from "lib/StoryEngine";
import { expect } from "./TestUtils";

async function go() {
  const playthru = createDefaultPlaythru("test", {
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
  const scope = createScope(playthru);
  const text = await renderText(
    `hello {{f}} or {{a.b.c}} or {$ 1 + g.h.i $}`,
    scope,
    new PRNG("test"),
    null
  );
  expect(text, "hello foo or coco or 4");
}

go();
