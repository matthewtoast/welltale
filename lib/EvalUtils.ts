import { Parser } from "expr-eval";
import { PRNG } from "./RandHelpers";
import { isPresent } from "./TextHelpers";

export type Tag = { name: string; rule: string; args: string[] };

const tokRE = /\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\b/g;
const isNum = (v: unknown) =>
  v === true ? 1 : typeof v === "number" && isFinite(v) ? v : 0;

export const buildTagger = (
  defs: Tag[],
  fns: Record<string, (...a: number[]) => number | boolean> = {}
) => {
  const parser = new Parser();
  const fnNames = new Set(Object.keys(fns));
  const compiled = new Map(
    defs.map(({ name, rule }) => [
      name,
      {
        expr: parser.parse(rule),
        toks: Array.from(new Set(rule.match(tokRE) ?? [])),
      },
    ])
  );
  const cache = new Map<number, Map<string, number>>();

  const resolve = (id: number, tag: string, seen: Set<string>): number => {
    const memo = cache.get(id) ?? cache.set(id, new Map()).get(id)!;
    if (memo.has(tag)) return memo.get(tag)!;
    const key = `${id}:${tag}`;
    if (seen.has(key)) return 0;
    seen.add(key);

    const rec = compiled.get(tag);
    if (!rec) return 0;

    const env: Record<string, unknown> = { id, ...fns };

    for (const t of rec.toks) {
      if (t === "id" || fnNames.has(t)) continue;
      if (!t.includes(".")) env[t] = resolve(id, t, seen);
      else {
        let cur = id;
        for (const p of t.split(".")) {
          cur = resolve(cur, p, seen);
          if (cur <= 0) break;
        }
        env[t] = cur;
      }
    }

    let val = 0;
    try {
      val = isNum(rec.expr.evaluate(env as any));
    } catch {}
    memo.set(tag, val);
    seen.delete(key);
    return val;
  };

  const rule = (id: number, tag: string) => resolve(id, tag, new Set());

  const tags = (id: number) => {
    const o: Record<string, number> = {};
    for (const n of compiled.keys()) o[n] = rule(id, n);
    return o;
  };

  return { rule, tags };
};

export const rawToTags = (
  raw: string,
  assign: string = "->",
  delim: string = ";"
): Tag[] => {
  const lines = raw
    .trim()
    .split(delim)
    .map((s) => s.trim())
    .map((line) => {
      return line.replaceAll(/#.*/g, "").trim();
    })
    .filter((line) => isPresent(line));
  return lines.map((line) => {
    const [name, rule, ...args] = line.split(assign).map((l) => l.trim());
    return { name, rule, args };
  });
};

export type Primitive = number | boolean | string | null;
export type EvalResult = Primitive | Primitive[];
export type Scope = Record<string, Primitive | Primitive[]>;

type P = number | boolean | string | null;
type A = P | P[];

const isP = (v: unknown): v is P =>
  v === null || ["number", "string", "boolean"].includes(typeof v);
const toArr = (v: A): P[] => (Array.isArray(v) ? v : [v]);
const num = (v: P) => (typeof v === "number" ? v : Number(v as any));
const cmp = (a: P, b: P) => (a === b ? 0 : a! < b! ? -1 : 1);
const eq = (a: A, b: A): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++)
      if (!eq(a[i] as any, b[i] as any)) return false;
    return true;
  }
  return a === b;
};
const uniq = (arr: P[]) => {
  const out: P[] = [];
  for (const v of arr) if (!out.some((x) => eq(x, v))) out.push(v);
  return out;
};
const flatDeep = (arr: any[], d: number): any[] =>
  d <= 0
    ? arr.slice()
    : arr.reduce<any[]>(
        (r, v) => r.concat(Array.isArray(v) ? flatDeep(v, d - 1) : v),
        []
      );

export const arrayHelpers: Record<string, (...args: any[]) => P | P[]> = {
  len: (a: A) => toArr(a).length,
  first: (a: A) => toArr(a)[0] ?? null,
  last: (a: A) => {
    const t = toArr(a);
    return t[t.length - 1] ?? null;
  },
  nth: (a: A, i: P) => toArr(a)[num(i) | 0] ?? null,
  slice: (a: A, s: P, e?: P) =>
    toArr(a).slice(num(s) | 0, e == null ? undefined : num(e) | 0),
  take: (a: A, n: P) => toArr(a).slice(0, num(n) | 0),
  drop: (a: A, n: P) => toArr(a).slice(num(n) | 0),
  concat: (a: A, b: A) => toArr(a).concat(toArr(b)),
  reverse: (a: A) => toArr(a).slice().reverse(),
  sort: (a: A) => toArr(a).slice().sort(cmp),
  sortDesc: (a: A) =>
    toArr(a)
      .slice()
      .sort((x, y) => -cmp(x, y)),
  uniq: (a: A) => uniq(toArr(a)),
  flatten: (a: A) =>
    toArr(a).reduce<P[]>((r, v) => r.concat(Array.isArray(v) ? v : [v]), []),
  flattenDeep: (a: A, depth?: P) =>
    flatDeep(toArr(a) as any[], depth == null ? 1 / 0 : num(depth) | 0),
  includes: (a: A, v: A) => toArr(a).some((x) => eq(x, v)),
  indexOf: (a: A, v: A) => {
    const t = toArr(a);
    for (let i = 0; i < t.length; i++) if (eq(t[i], v)) return i;
    return -1;
  },
  count: (a: A, v: A) =>
    toArr(a).reduce((c, x) => (c as number) + (eq(x, v) ? 1 : 0), 0),
  compact: (a: A) => toArr(a).filter((x) => !!x),
  sum: (a: A) => toArr(a).reduce((s, x) => (s as number) + num(x ?? 0), 0),
  mean: (a: A) => {
    const t = toArr(a);
    return t.length
      ? (t.reduce((s, x) => (s as number) + num(x ?? 0), 0) as number) /
          t.length
      : 0;
  },
  min: (a: A) => {
    const t = toArr(a);
    if (!t.length) return null;
    return t.slice().sort(cmp)[0];
  },
  max: (a: A) => {
    const t = toArr(a);
    if (!t.length) return null;
    return t.slice().sort(cmp)[t.length - 1];
  },
  median: (a: A) => {
    const t = toArr(a).slice().sort(cmp);
    const n = t.length;
    if (!n) return null;
    return n % 2 ? t[(n - 1) / 2] : (num(t[n / 2 - 1]) + num(t[n / 2])) / 2;
  },
  sumBy: (a: A, k: P) =>
    toArr(a).reduce(
      (s, x) =>
        (s as number) +
        num(Array.isArray(x) ? ((x[num(k ?? 0) | 0] as P) ?? 0) : (x ?? 0)),
      0
    ),
  mapAdd: (a: A, n: P) => toArr(a).map((x) => num(x) + num(n)),
  mapSub: (a: A, n: P) => toArr(a).map((x) => num(x) - num(n)),
  mapMul: (a: A, n: P) => toArr(a).map((x) => num(x) * num(n)),
  mapDiv: (a: A, n: P) => toArr(a).map((x) => num(x) / num(n)),
  gt: (a: P, b: P) => num(a) > num(b),
  lt: (a: P, b: P) => num(a) < num(b),
  gte: (a: P, b: P) => num(a) >= num(b),
  lte: (a: P, b: P) => num(a) <= num(b),
  equals: (a: A, b: A) => eq(a, b),
  union: (a: A, b: A) => uniq(toArr(a).concat(toArr(b))),
  intersection: (a: A, b: A) => {
    const tb = toArr(b);
    return uniq(toArr(a).filter((x) => tb.some((y) => eq(x, y))));
  },
  difference: (a: A, b: A) => {
    const tb = toArr(b);
    return toArr(a).filter((x) => !tb.some((y) => eq(x, y)));
  },
};

const toStr = (v: P) => (v == null ? "" : String(v));
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const unCapFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const kebab = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
const snake = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
const camel = (s: string) => {
  return s
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (m) => m.toLowerCase());
};

export const stringHelpers: Record<string, (...args: any[]) => P> = {
  lower: (v: P) => toStr(v).toLowerCase(),
  upper: (v: P) => toStr(v).toUpperCase(),
  capitalize: (v: P) => capFirst(toStr(v).toLowerCase()),
  uncapitalize: (v: P) => unCapFirst(toStr(v)),
  trim: (v: P) => toStr(v).trim(),
  trimStart: (v: P) => toStr(v).trimStart(),
  trimEnd: (v: P) => toStr(v).trimEnd(),
  padStart: (v: P, len: P, pad?: P) =>
    toStr(v).padStart(Number(len) || 0, toStr(pad ?? " ")),
  padEnd: (v: P, len: P, pad?: P) =>
    toStr(v).padEnd(Number(len) || 0, toStr(pad ?? " ")),
  repeat: (v: P, n: P) => toStr(v).repeat(Number(n) || 0),
  replace: (v: P, search: P, repl: P) =>
    toStr(v).split(toStr(search)).join(toStr(repl)),
  includes: (v: P, sub: P) => toStr(v).includes(toStr(sub)),
  startsWith: (v: P, sub: P) => toStr(v).startsWith(toStr(sub)),
  endsWith: (v: P, sub: P) => toStr(v).endsWith(toStr(sub)),
  substring: (v: P, start: P, end?: P) =>
    toStr(v).substring(
      Number(start) || 0,
      end == null ? undefined : Number(end) || 0
    ),
  slice: (v: P, start: P, end?: P) =>
    toStr(v).slice(
      Number(start) || 0,
      end == null ? undefined : Number(end) || 0
    ),
  indexOf: (v: P, sub: P) => toStr(v).indexOf(toStr(sub)),
  lastIndexOf: (v: P, sub: P) => toStr(v).lastIndexOf(toStr(sub)),
  kebabCase: (v: P) => kebab(toStr(v)),
  snakeCase: (v: P) => snake(toStr(v)),
  camelCase: (v: P) => camel(toStr(v)),
  concat: (a: P, b: P) => toStr(a) + toStr(b),
  join: (...args: any[]) => {
    const sep = toStr(args.pop());
    return args.map(toStr).join(sep);
  },
  split: (v: P, sep: P) => toStr(v).split(toStr(sep)) as any,
  reverseStr: (v: P) => toStr(v).split("").reverse().join(""),
  length: (v: P) => toStr(v).length,
};

export const createRandomHelpers = (
  prng: PRNG
): Record<string, (...args: any[]) => P | P[]> => ({
  random: () => prng.next(),
  randInt: (min: P, max: P) => prng.getRandomInt(num(min), num(max)),
  randFloat: (min: P, max: P) => prng.getRandomFloat(num(min), num(max)),
  randNormal: (min: P, max: P) => prng.getRandomFloatNormal(num(min), num(max)),
  randIntNormal: (min: P, max: P) =>
    prng.getRandomIntNormal(num(min), num(max)),
  coinToss: (prob?: P) => prng.coinToss(prob == null ? 0.5 : num(prob)),
  dice: (sides?: P) => prng.dice(sides == null ? 6 : num(sides)),
  rollDice: (rolls: P, sides?: P) =>
    prng.rollMultipleDice(num(rolls), sides == null ? 6 : num(sides)),
  randElement: (arr: A) => {
    const t = toArr(arr);
    return t.length ? prng.randomElement(t) : null;
  },
  shuffle: (arr: A) => prng.shuffle(toArr(arr)),
  randAlphaNum: (len: P) => prng.randAlphaNum(num(len)),
  weightedRandom: (weights: P[]) => {
    const w = toArr(weights);
    if (!w.length) return null;
    const obj: Record<string, number> = {};
    w.forEach((v, i) => {
      obj[i.toString()] = num(v ?? 0);
    });
    return Number(prng.weightedRandomKey(obj));
  },
  sample: (arr: A, n: P) => {
    const t = toArr(arr);
    const size = Math.min(num(n), t.length);
    const shuffled = prng.shuffle(t);
    return shuffled.slice(0, size);
  },
});

type Func = (...args: Primitive[]) => EvalResult;

export const evalExpr = (
  expr: string,
  vars: Scope = {},
  funcs: Record<string, Func> = {},
  prng: PRNG,
  prev: Parser = new Parser()
): EvalResult => {
  const parser = getParser(funcs, prng, prev);
  const node = parser.parse(expr);
  try {
    console.log(111, expr, vars);
    return node.evaluate(vars as any) as EvalResult;
  } catch (error) {
    console.warn(error);
    return false;
  }
};

export function getParser(
  funcs: Record<string, Func> = {},
  prng: PRNG,
  parser: Parser = new Parser()
) {
  const randomHelpers = createRandomHelpers(prng);
  Object.assign(
    parser.functions,
    arrayHelpers,
    stringHelpers,
    randomHelpers,
    funcs
  );
  return parser;
}

export const findMissingFuncs = (
  expr: string,
  funcs: Record<string, Func> = {},
  prng: PRNG,
  parser: Parser = new Parser()
) => {
  const p = getParser(funcs, prng, parser);
  Object.assign(p.functions, funcs);
  const called = new Set<string>();
  const re = /([A-Za-z_]\w*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) called.add(m[1]);
  const defined = new Set(Object.keys(p.functions));
  return [...called].filter((n) => !defined.has(n));
};

export function castToBoolean(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0 && !isNaN(v);
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "1"].includes(s)) return true;
    if (["false", "no", "0", ""].includes(s)) return false;
    return Boolean(s);
  }
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v).length > 0;
  return Boolean(v);
}

export function castToNumber(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return isNaN(n) ? 0 : n;
  }
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") return Object.keys(v).length;
  return 0;
}

export function castToString(v: any): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(castToString).join(",");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function cast(v: any, to: CastableType) {
  switch (to) {
    case "boolean":
      return castToBoolean(v);
    case "number":
      return castToNumber(v);
    case "string":
      return castToString(v);
    default:
      throw new Error(`Unknown cast type: ${to}`);
  }
}

export function stringToCastType(s: string): CastableType {
  const normalized = s.trim().toLowerCase();
  if (["bool", "boolean"].includes(normalized)) return "boolean";
  if (["num", "number", "float", "int"].includes(normalized)) return "number";
  if (["str", "string", "text"].includes(normalized)) return "string";
  return "string";
}

export function looksLikeBoolean(s: string): boolean {
  return s === "true" || s === "false";
}

export function looksLikeNumber(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed === "") return false;
  // Only allow if the string is a valid number and does not contain extraneous characters
  // Disallow things like "123abc", "1.2.3", etc.
  // Allow integers, floats, scientific notation, negative numbers
  return /^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed);
}

export type CastableType = "boolean" | "number" | "string";
