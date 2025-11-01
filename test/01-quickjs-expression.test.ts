import { getReadableScope } from "../lib/engine/StoryConstants";
import { renderText } from "../lib/engine/StoryRenderMethods";
import { MockStoryServiceProvider } from "../lib/engine/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
} from "../lib/engine/StoryTypes";
import { buildDefaultFuncs } from "../lib/EvalMethods";
import { createRunner, evaluateScript } from "../lib/QuickJSUtils";
import { PRNG } from "../lib/RandHelpers";
import { TSerial } from "../typings";
import { expect } from "./TestUtils";

async function run() {
  const emptySource = {
    root: { addr: "", type: "root", atts: {}, kids: [], text: "" },
    voices: {},
    pronunciations: {},
    scripts: {},
    meta: {},
  };
  const rng = new PRNG("test");
  const runner = await createRunner();
  const funcs = buildDefaultFuncs({}, rng);
  const provider = new MockStoryServiceProvider();

  function makeContext(scope: Record<string, TSerial>): BaseActionContext {
    const session = createDefaultSession("test", emptySource, scope);
    return {
      session,
      rng,
      provider,
      evaluator: async (expr, vars) => {
        return await evaluateScript(expr, vars, funcs, runner);
      },
      options: {
        verbose: false,
        seed: "test",
        ream: 100,
        doGenerateAudio: false,
        doGenerateImage: false,
        maxCheckpoints: 20,
        inputRetryMax: 3,
        models: DEFAULT_LLM_SLUGS,
      },
    };
  }

  const c1 = makeContext({ value: 3 });
  const first = await renderText(
    "value {$\n      value +\n      2\n    $}",
    getReadableScope(c1.session),
    c1
  );
  expect(first, "value 5");

  const c2 = makeContext({ items: [1, 2, 3], mult: 2 });
  const second = await renderText(
    "sum {$\n      items\n        .map((n) => n * mult)\n        .reduce((total, n) => total + n, 0)\n    $}",
    getReadableScope(c2.session),
    c2
  );
  expect(second, "sum 12");
}

run();
