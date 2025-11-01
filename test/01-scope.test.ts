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
import { expect } from "./TestUtils";

async function go() {
  const emptySource = {
    root: { addr: "", type: "root", atts: {}, kids: [], text: "" },
    voices: {},
    pronunciations: {},
    scripts: {},
    meta: {},
  };
  const session = createDefaultSession("test", emptySource, {
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

  const rng = new PRNG("test");
  const scriptRunner = await createRunner();
  const funcs = buildDefaultFuncs({}, rng);
  const mockProvider = new MockStoryServiceProvider();
  const context: BaseActionContext = {
    session,
    rng,
    provider: mockProvider,
    evaluator: async (expr, scope) => {
      return await evaluateScript(expr, scope, funcs, scriptRunner);
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

  const text = await renderText(
    `hello {{f}} or {{a.b.c}} or {$ 1 + g.h.i $}`,
    getReadableScope(context.session),
    context
  );
  expect(text, "hello foo or coco or 4");
}

go();
