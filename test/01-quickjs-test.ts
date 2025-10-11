import { buildDefaultFuncs, Primitive } from "../lib/EvalMethods";
import { createRunner, evaluateScript } from "../lib/QuickJSUtils";
import { PRNG } from "../lib/RandHelpers";
import { expect } from "./TestUtils";

async function go() {
  const state = { n: 3 };
  const runner = await createRunner();
  const prng = new PRNG("test");
  const funcs = buildDefaultFuncs(
    {
      wim: (n: Primitive) => (n as number) * (n as number),
    },
    prng
  );

  await evaluateScript(
    'var x=1; set("y", x*2 + n + wim(5))',
    state,
    funcs,
    runner
  );
  expect(state, { n: 3, y: 30 });

  await evaluateScript(
    `
      import {fooo} from './foo.ts'
      set("yum", 1)
    `,
    state,
    funcs,
    runner,
    { "foo.ts": "export function fooo() { return 1; }" }
  );
  expect(state, { n: 3, y: 30, yum: 1 });

  const a = await evaluateScript(
    'clamp(toNumber("28"), 1, 120)',
    {},
    funcs,
    runner
  );
  expect(a, 28);

  const b = await evaluateScript(
    "1 + g.h.i",
    {
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
    },
    funcs,
    runner
  );
  expect(b, 4);

  const c = await evaluateScript(
    `empty(xx) || !xx.toLowerCase().startsWith("x")`,
    {
      xx: "foobar",
    },
    funcs,
    runner
  );
  expect(c, true);

  const d = await evaluateScript(
    `empty(xx) || !xx.toLowerCase().startsWith("x")`,
    {
      xx: "",
    },
    funcs,
    runner
  );
  expect(d, true);

  // const e = await evaluateScript(
  //   `empty(xx) || !startsWith(lower(xx), "x")`,
  //   {},
  //   funcs,
  //   runner
  // );
  // expect(e, true);
}

go();
