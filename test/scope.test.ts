import { PRNG } from "lib/RandHelpers";
import { createDefaultSession, createScope, renderText, BaseActionContext } from "lib/StoryEngine";
import { expect } from "./TestUtils";
import { MockStoryServiceProvider } from "lib/StoryServiceProvider";
import { DEFAULT_LLM_SLUGS } from "lib/StoryTypes";

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
  const mockProvider = new MockStoryServiceProvider();
  const context: BaseActionContext = {
    scope,
    rng: new PRNG("test"),
    provider: mockProvider,
    options: {
      verbose: false,
      seed: "test",
      loop: 0,
      ream: 100,
      doGenerateSpeech: false,
      doGenerateAudio: false,
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

  const introSession = createDefaultSession("intro");
  introSession.stack.push({
    returnAddress: "0",
    scope: null,
    blockType: "intro",
  });
  const introScope = createScope(introSession);
  introScope.introVar = "intro";
  expect(introSession.state.introVar, "intro");

  const mixedSession = createDefaultSession("mixed");
  const scopeFrame = {
    returnAddress: "1",
    scope: {} as { [key: string]: unknown },
    blockType: "scope" as const,
  };
  mixedSession.stack.push(scopeFrame);
  mixedSession.stack.push({
    returnAddress: "2",
    scope: null,
    blockType: "intro",
  });
  const mixedScope = createScope(mixedSession);
  mixedScope.blockVar = "block";
  expect(scopeFrame.scope.blockVar, "block");

  const yieldSession = createDefaultSession("yield");
  const yieldFrame = {
    returnAddress: "3",
    scope: {} as { [key: string]: unknown },
    blockType: "yield" as const,
  };
  yieldSession.stack.push(yieldFrame);
  const yieldScope = createScope(yieldSession);
  yieldScope.param = "value";
  expect(yieldFrame.scope.param, "value");
}

go();
