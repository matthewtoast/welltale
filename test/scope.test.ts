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
}

go();
