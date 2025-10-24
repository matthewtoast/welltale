import { createScope } from "../lib/engine/StoryEngine";
import { renderText } from "../lib/engine/StoryRenderMethods";
import { MockStoryServiceProvider } from "../lib/engine/StoryServiceProvider";
import {
  BaseActionContext,
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  TSessionStackObj,
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
    scope: session.state,
    evaluator: async (expr, scope) => {
      return await evaluateScript(expr, scope, funcs, scriptRunner);
    },
    options: {
      verbose: false,
      seed: "test",
      loop: 0,
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
    context
  );
  expect(text, "hello foo or coco or 4");

  const introSession = createDefaultSession("intro", emptySource);
  introSession.stack.push({
    returnAddress: "0",
    writeableScope: null,
    readableScope: null,
    blockType: "intro",
  });
  const introScope = createScope(introSession, {});
  introScope.introVar = "intro";
  expect(introSession.state.introVar, "intro");

  const mixedSession = createDefaultSession("mixed", emptySource);
  const scopeFrame: TSessionStackObj = {
    returnAddress: "1",
    writeableScope: {},
    readableScope: {},
    blockType: "scope" as const,
  };
  mixedSession.stack.push(scopeFrame);
  mixedSession.stack.push({
    returnAddress: "2",
    writeableScope: null,
    readableScope: null,
    blockType: "intro",
  });
  const mixedScope = createScope(mixedSession, {});
  mixedScope.blockVar = "block";
  expect(scopeFrame.writeableScope!.blockVar, "block");

  const yieldSession = createDefaultSession("yield", emptySource);
  const yieldFrame: TSessionStackObj = {
    returnAddress: "3",
    writeableScope: {},
    readableScope: {},
    blockType: "yield" as const,
  };
  yieldSession.stack.push(yieldFrame);
  const yieldScope = createScope(yieldSession, {});
  yieldScope.param = "value";
  expect(yieldFrame.writeableScope!.param, "value");
}

go();
