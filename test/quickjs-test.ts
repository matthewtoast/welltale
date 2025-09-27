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
}
go();
