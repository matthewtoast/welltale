import type { BaseActionContext } from "./StoryEngine";
import { PRNG } from "./RandHelpers";
import type { StoryServiceProvider } from "./StoryServiceProvider";
import { DEFAULT_LLM_SLUGS, type StoryOptions } from "./StoryTypes";
import type { TSerial } from "typings";

export function makeOptions(seed: string, verbose = false): StoryOptions {
  return {
    verbose,
    seed,
    loop: 0,
    ream: 100,
    doGenerateSpeech: false,
    doGenerateAudio: false,
    maxCheckpoints: 20,
    models: DEFAULT_LLM_SLUGS,
  };
}

export function makeBaseCtx(
  provider: StoryServiceProvider,
  options: StoryOptions,
  scope: Record<string, TSerial> = {}
): BaseActionContext {
  const rng = new PRNG(options.seed);
  return { rng, provider, scope, options };
}
