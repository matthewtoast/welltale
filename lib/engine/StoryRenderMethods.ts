import { castToString } from "../EvalCasting";
import { renderTemplate } from "../Template";
import { DOLLAR, enhanceText, isBlank, LIQUID } from "../TextHelpers";
import { NONRENDER_ATTS } from "./StoryConstants";
import { resolveBracketDDV } from "./StoryDDVHelpers";
import {
  BaseActionContext,
  CompilerContext,
  DEFAULT_LLM_SLUGS,
} from "./StoryTypes";

export async function renderText(
  text: string,
  ctx: BaseActionContext | CompilerContext
): Promise<string> {
  if (isBlank(text) || text.length < 3) {
    return text;
  }
  // {{handlebars}} for interpolation
  let result = renderTemplate(text, ctx.scope);
  // {$dollars$} for scripting
  result = await enhanceText(
    result,
    async (chunk: string) => {
      return castToString(await ctx.evaluator(chunk, ctx.scope));
    },
    DOLLAR
  );
  // [[this|kind|of]] dynamic variation
  const ddvCtx =
    "session" in ctx
      ? { rng: ctx.rng, session: { ddv: ctx.session.ddv } }
      : { rng: ctx.rng, session: { ddv: ctx.ddv } };
  result = resolveBracketDDV(result, ddvCtx);
  // {%liquid%} for inline LLM calls
  result = await enhanceText(
    result,
    async (chunk: string) => {
      return await ctx.provider!.generateText(chunk, {
        models: ctx.options?.models ?? DEFAULT_LLM_SLUGS,
        useWebSearch: false,
      });
    },
    LIQUID
  );
  return result;
}

export async function renderAtts(
  atts: Record<string, string>,
  ctx: BaseActionContext | CompilerContext
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
        out[key] = await renderText(atts[key], ctx);
      }
    }
  }
  return out;
}
