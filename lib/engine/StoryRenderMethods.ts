import { TSerial } from "../../typings";
import { castToString } from "../EvalCasting";
import { PRNG } from "../RandHelpers";
import { renderTemplate } from "../Template";
import { DOLLAR, enhanceText, isBlank, LIQUID } from "../TextHelpers";
import { NONRENDER_ATTS } from "./StoryConstants";
import { resolveBracketDDV } from "./StoryDDVHelpers";
import { StoryServiceProvider } from "./StoryServiceProvider";
import {
  CompilerOptions,
  DDVState,
  DEFAULT_LLM_SLUGS,
  EvaluatorFunc,
} from "./StoryTypes";

export type RenderOpts = {
  evaluator: EvaluatorFunc;
  rng: PRNG;
  session: { ddv: DDVState };
  provider: StoryServiceProvider;
  options: CompilerOptions;
};

export async function renderText(
  text: string,
  scope: Record<string, TSerial>,
  opts: RenderOpts
): Promise<string> {
  if (isBlank(text) || text.length < 3) {
    return text;
  }
  // {{handlebars}} for interpolation
  let result = renderTemplate(text, scope);
  // {$dollars$} for scripting
  result = await enhanceText(
    result,
    async (chunk: string) => {
      return castToString(await opts.evaluator(chunk, scope));
    },
    DOLLAR
  );
  // [[this|kind|of]] dynamic variation
  const ddvCtx = { rng: opts.rng, session: opts.session };
  result = resolveBracketDDV(result, ddvCtx);
  // {%liquid%} for inline LLM calls
  result = await enhanceText(
    result,
    async (chunk: string) => {
      return await opts.provider.generateText(chunk, {
        models: opts.options.models ?? DEFAULT_LLM_SLUGS,
        useWebSearch: false,
      });
    },
    LIQUID
  );
  return result;
}

export async function renderAtts(
  atts: Record<string, string>,
  scope: Record<string, TSerial>,
  opts: RenderOpts
) {
  const out: Record<string, string> = {};
  for (const key in atts) {
    if (typeof atts[key] === "string") {
      const nonrender = NONRENDER_ATTS.filter(
        (s) => key === s || (s.startsWith(".") && key.endsWith(s))
      );
      if (nonrender.length > 0) {
        out[key] = atts[key];
      } else {
        out[key] = await renderText(atts[key], scope, opts);
      }
    }
  }
  return out;
}
