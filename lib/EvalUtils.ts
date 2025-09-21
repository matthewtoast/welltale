import { Parser } from "expr-eval";
import { Primitive } from "zod";
import { TSerial } from "../typings";
import {
  arrayHelpers,
  createRandomHelpers,
  dateHelpers,
  EvalResult,
  mathHelpers,
  stringHelpers,
  unifiedHelpers,
} from "./EvalMethods";
import { PRNG } from "./RandHelpers";

type Func = (...args: Primitive[]) => EvalResult;

function makeParser() {
  return new Parser({
    operators: {
      assignment: true,
    },
  });
}

export const evalExpr = (
  expr: string,
  vars: Record<string, TSerial>,
  funcs: Record<string, Func> = {},
  prng: PRNG,
  prev: Parser = makeParser()
): EvalResult => {
  const parser = getParser(funcs, prng, prev);
  const node = parser.parse(expr);
  try {
    return node.evaluate(vars as any) as EvalResult;
  } catch (error) {
    console.warn(error);
    return false;
  }
};

export function getParser(
  funcs: Record<string, Func> = {},
  prng: PRNG,
  parser: Parser = makeParser()
) {
  const randomHelpers = createRandomHelpers(prng);
  Object.assign(
    parser.functions,
    arrayHelpers,
    stringHelpers,
    unifiedHelpers,
    mathHelpers,
    dateHelpers,
    randomHelpers,
    funcs
  );
  return parser;
}

export function ensureArray(a: any): any[] {
  if (Array.isArray(a)) {
    return a;
  }
  if (a === null || a === undefined || isNaN(a)) {
    return [];
  }
  return [a];
}
