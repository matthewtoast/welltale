import { ExprEvalFunc } from "./EvalCasting";
import { arrayHelpers } from "./methods/ArrayMethods";
import { dateHelpers } from "./methods/DateMethods";
import { mathHelpers } from "./methods/MathMethods";
import { createRandomHelpers } from "./methods/RandMethods";
import { stringHelpers } from "./methods/StringMethods";
import { unifiedHelpers } from "./methods/UnifiedMethods";
import { PRNG } from "./RandHelpers";

export function buildDefaultFuncs(
  funcs: Record<string, ExprEvalFunc> = {},
  prng: PRNG
) {
  const randomHelpers = createRandomHelpers(prng);

  const out: Record<string, ExprEvalFunc> = {};

  for (const key in arrayHelpers) {
    out[key] = arrayHelpers[key].fn;
  }
  for (const key in stringHelpers) {
    out[key] = stringHelpers[key].fn;
  }
  for (const key in unifiedHelpers) {
    out[key] = unifiedHelpers[key].fn;
  }
  for (const key in mathHelpers) {
    out[key] = mathHelpers[key].fn;
  }
  for (const key in dateHelpers) {
    out[key] = dateHelpers[key].fn;
  }
  for (const key in randomHelpers) {
    out[key] = randomHelpers[key].fn;
  }
  for (const key in funcs) {
    out[key] = funcs[key];
  }

  return out;
}
