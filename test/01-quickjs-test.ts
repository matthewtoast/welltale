import { buildDefaultFuncs } from "../lib/EvalMethods";
import { createRunner, evaluateScript } from "../lib/QuickJSUtils";
import { PRNG } from "../lib/RandHelpers";
import { TSerial } from "../typings";
import { expect } from "./TestUtils";

async function go() {
  const state = { n: 3 };
  const runner = await createRunner();
  const prng = new PRNG("test");
  const funcs = buildDefaultFuncs(
    {
      wim: (n: TSerial) => (n as number) * (n as number),
    },
    prng
  );

  await evaluateScript(
    'var x=1; wsl.set("y", x*2 + n + wsl.wim(5))',
    state,
    funcs,
    runner
  );
  expect(state, { n: 3, y: 30 });

  await evaluateScript(
    `
      import {fooo} from './foo.ts'
      wsl.set("yum", 1)
    `,
    state,
    funcs,
    runner,
    { "foo.ts": "export function fooo() { return 1; }" }
  );
  expect(state, { n: 3, y: 30, yum: 1 });

  const a = await evaluateScript(
    'wsl.clamp(wsl.toNumber("28"), 1, 120)',
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
    `wsl.empty(xx) || !xx.toLowerCase().startsWith("x")`,
    {
      xx: "foobar",
    },
    funcs,
    runner
  );
  expect(c, true);

  const d = await evaluateScript(
    `wsl.empty(xx) || !xx.toLowerCase().startsWith("x")`,
    {
      xx: "",
    },
    funcs,
    runner
  );
  expect(d, true);

  // Ensure trailing semicolon is ok
  const e = await evaluateScript(
    `xx.toLowerCase().startsWith("x");`,
    {
      xx: "xyz",
    },
    funcs,
    runner
  );
  expect(e, true);

  // Ensure we can redefine built-in var
  const f = await evaluateScript(
    // weekdayName is defined as a function so this raises "SyntaxError: invalid redefinition of lexical identifier"
    `const weekdayName = "Wednesday"`,
    {},
    funcs,
    runner
  );
}

go();
