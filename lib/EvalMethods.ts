import {
  castToBoolean,
  castToNumber,
  castToString,
  ExprEvalFunc,
} from "./EvalCasting";
import { PRNG } from "./RandHelpers";
import { isBlank } from "./TextHelpers";

export type Primitive = number | boolean | string | null;

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
  arrayLen: (a: A) => toArr(a).length,
  arrayLength: (a: A) => toArr(a).length,
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
  contains: (a: A, v: A) => toArr(a).some((x) => eq(x, v)),
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
  titleCase: (v: P) =>
    toStr(v).replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    ),
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
  length: (v: P) => (Array.isArray(v) ? v.length : toStr(v).length),

  // Natural language helpers
  listize: (arr: P[], sep?: P, lastSep?: P) => {
    const t = toArr(arr).map(toStr);
    if (!t.length) return "";
    if (t.length === 1) return t[0];
    const s = toStr(sep ?? ", ");
    const l = toStr(lastSep ?? " and ");
    return t.slice(0, -1).join(s) + l + t[t.length - 1];
  },
  pluralize: (word: P, count: P, pluralForm?: P) => {
    const w = toStr(word);
    const n = num(count);
    if (n === 1) return w;
    return pluralForm == null ? w + "s" : toStr(pluralForm);
  },
  ordinalize: (n: P) => {
    const v = Math.abs(num(n));
    const s = ["th", "st", "nd", "rd"];
    const v10 = v % 100;
    return v + (s[(v10 - 20) % 10] || s[v10] || s[0]);
  },
  quote: (v: P, quoteChar?: P) => {
    const q = toStr(quoteChar ?? '"');
    return q + toStr(v) + q;
  },
  unquote: (v: P, quoteChar?: P) => {
    const s = toStr(v);
    const q = toStr(quoteChar ?? '"');
    if (s.startsWith(q) && s.endsWith(q)) return s.slice(1, -1);
    return s;
  },
};

const isString = (v: unknown): v is string => typeof v === "string";
const toArrOrStr = (v: A): P[] | string =>
  isString(v) ? v : Array.isArray(v) ? v : [v];

export const unifiedHelpers: Record<string, (...args: any[]) => P | P[]> = {
  length: (v: A) => {
    if (isString(v)) return v.length;
    return toArr(v).length;
  },
  includes: (v: A, search: A) => {
    if (isString(v) && isString(search)) return v.includes(search);
    if (isString(v)) return false;
    return toArr(v).some((x) => eq(x, search));
  },
  indexOf: (v: A, search: A) => {
    if (isString(v) && isString(search)) return v.indexOf(search);
    if (isString(v)) return -1;
    const arr = toArr(v);
    for (let i = 0; i < arr.length; i++) if (eq(arr[i], search)) return i;
    return -1;
  },
  slice: (v: A, start: P, end?: P) => {
    const s = num(start) | 0;
    const e = end == null ? undefined : num(end) | 0;
    if (isString(v)) return v.slice(s, e);
    return toArr(v).slice(s, e);
  },
  concat: (a: A, b: A) => {
    if (isString(a) && isString(b)) return a + b;
    if (isString(a) || isString(b)) {
      const aStr = Array.isArray(a) ? a.join(",") : toStr(a as P);
      const bStr = Array.isArray(b) ? b.join(",") : toStr(b as P);
      return aStr + bStr;
    }
    return toArr(a).concat(toArr(b));
  },
  reverse: (v: A) => {
    if (isString(v)) return v.split("").reverse().join("");
    return toArr(v).slice().reverse();
  },
  blank: (v: any) => {
    return isBlank(v);
  },
  empty: (v: any) => {
    return isBlank(v);
  },
  not: (v: any) => {
    return !v;
  },
  // Type casting functions
  toNumber: (v: any) => {
    return castToNumber(v);
  },
  toNum: (v: any) => castToNumber(v),
  toString: (v: any) => castToString(v),
  toStr: (v: any) => castToString(v),
  toBoolean: (v: any) => castToBoolean(v),
  toBool: (v: any) => castToBoolean(v),
};

export const mathHelpers: Record<string, (...args: any[]) => P> = {
  abs: (v: P) => Math.abs(num(v)),
  max: (...args: P[]) => Math.max(...args.map(num)),
  min: (...args: P[]) => Math.min(...args.map(num)),
  clamp: (v: P, min: P, max: P) =>
    Math.max(num(min), Math.min(num(max), num(v))),
  avg: (...args: P[]) => {
    if (!args.length) return 0;
    return args.reduce<number>((s, x) => s + num(x), 0) / args.length;
  },
  average: (...args: P[]) => {
    if (!args.length) return 0;
    return args.reduce<number>((s, x) => s + num(x), 0) / args.length;
  },
  pow: (base: P, exp: P) => Math.pow(num(base), num(exp)),
  sqrt: (v: P) => Math.sqrt(num(v)),
  cbrt: (v: P) => Math.cbrt(num(v)),
  exp: (v: P) => Math.exp(num(v)),
  log: (v: P) => Math.log(num(v)),
  log10: (v: P) => Math.log10(num(v)),
  log2: (v: P) => Math.log2(num(v)),
  sin: (v: P) => Math.sin(num(v)),
  cos: (v: P) => Math.cos(num(v)),
  tan: (v: P) => Math.tan(num(v)),
  asin: (v: P) => Math.asin(num(v)),
  acos: (v: P) => Math.acos(num(v)),
  atan: (v: P) => Math.atan(num(v)),
  atan2: (y: P, x: P) => Math.atan2(num(y), num(x)),
  sinh: (v: P) => Math.sinh(num(v)),
  cosh: (v: P) => Math.cosh(num(v)),
  tanh: (v: P) => Math.tanh(num(v)),
  asinh: (v: P) => Math.asinh(num(v)),
  acosh: (v: P) => Math.acosh(num(v)),
  atanh: (v: P) => Math.atanh(num(v)),
  floor: (v: P) => Math.floor(num(v)),
  ceil: (v: P) => Math.ceil(num(v)),
  round: (v: P) => Math.round(num(v)),
  trunc: (v: P) => Math.trunc(num(v)),
  sign: (v: P) => Math.sign(num(v)),
  gcd: (a: P, b: P) => {
    let x = Math.abs(num(a));
    let y = Math.abs(num(b));
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x;
  },
  lcm: (a: P, b: P) => {
    const na = num(a),
      nb = num(b);
    return Math.abs(na * nb) / (mathHelpers.gcd(na, nb) as number);
  },
  factorial: (n: P) => {
    const v = Math.floor(num(n));
    if (v < 0) return NaN;
    if (v === 0 || v === 1) return 1;
    let result = 1;
    for (let i = 2; i <= v; i++) result *= i;
    return result;
  },
  nCr: (n: P, r: P) => {
    const nn = Math.floor(num(n));
    const rr = Math.floor(num(r));
    if (rr > nn || rr < 0) return 0;
    return (
      (mathHelpers.factorial(nn) as number) /
      ((mathHelpers.factorial(rr) as number) *
        (mathHelpers.factorial(nn - rr) as number))
    );
  },
  nPr: (n: P, r: P) => {
    const nn = Math.floor(num(n));
    const rr = Math.floor(num(r));
    if (rr > nn || rr < 0) return 0;
    return (
      (mathHelpers.factorial(nn) as number) /
      (mathHelpers.factorial(nn - rr) as number)
    );
  },
  mod: (a: P, b: P) => num(a) % num(b),
  rem: (a: P, b: P) => num(a) % num(b),
  degToRad: (deg: P) => num(deg) * (Math.PI / 180),
  radToDeg: (rad: P) => num(rad) * (180 / Math.PI),
  lerp: (a: P, b: P, t: P) => {
    const na = num(a);
    const nb = num(b);
    const nt = num(t);
    return na + (nb - na) * nt;
  },
  inverseLerp: (a: P, b: P, v: P) => {
    const na = num(a);
    const nb = num(b);
    const nv = num(v);
    return (nv - na) / (nb - na);
  },
  map: (v: P, inMin: P, inMax: P, outMin: P, outMax: P) => {
    const nv = num(v);
    const t = (nv - num(inMin)) / (num(inMax) - num(inMin));
    return num(outMin) + t * (num(outMax) - num(outMin));
  },
  smoothstep: (edge0: P, edge1: P, x: P) => {
    const t = mathHelpers.clamp(
      (num(x) - num(edge0)) / (num(edge1) - num(edge0)),
      0,
      1
    );
    const nt = num(t);
    return nt * nt * (3 - 2 * nt);
  },
  step: (edge: P, x: P) => (num(x) < num(edge) ? 0 : 1),
  fract: (v: P) => {
    const n = num(v);
    return n - Math.floor(n);
  },
  isFinite: (v: P) => Number.isFinite(num(v)),
  isNaN: (v: P) => Number.isNaN(num(v)),
  isInteger: (v: P) => Number.isInteger(num(v)),
  isPrime: (n: P) => {
    const v = Math.floor(num(n));
    if (v <= 1) return false;
    if (v <= 3) return true;
    if (v % 2 === 0 || v % 3 === 0) return false;
    for (let i = 5; i * i <= v; i += 6) {
      if (v % i === 0 || v % (i + 2) === 0) return false;
    }
    return true;
  },
  variance: (...args: P[]) => {
    if (!args.length) return 0;
    const mean = mathHelpers.avg(...args) as number;
    return (
      args.reduce<number>((s, x) => {
        const d = num(x) - mean;
        return s + d * d;
      }, 0) / args.length
    );
  },
  stdDev: (...args: P[]) => Math.sqrt(mathHelpers.variance(...args) as number),
  standardDeviation: (...args: P[]) =>
    Math.sqrt(mathHelpers.variance(...args) as number),
  hypot: (...args: P[]) => Math.hypot(...args.map(num)),
  distance: (x1: P, y1: P, x2: P, y2: P) =>
    Math.hypot(num(x2) - num(x1), num(y2) - num(y1)),
  manhattan: (x1: P, y1: P, x2: P, y2: P) =>
    Math.abs(num(x2) - num(x1)) + Math.abs(num(y2) - num(y1)),
  normalize: (v: P, min: P, max: P) =>
    (num(v) - num(min)) / (num(max) - num(min)),
  denormalize: (v: P, min: P, max: P) =>
    num(v) * (num(max) - num(min)) + num(min),
  roundTo: (v: P, precision: P) => {
    const p = Math.pow(10, num(precision));
    return Math.round(num(v) * p) / p;
  },
  floorTo: (v: P, precision: P) => {
    const p = Math.pow(10, num(precision));
    return Math.floor(num(v) * p) / p;
  },
  ceilTo: (v: P, precision: P) => {
    const p = Math.pow(10, num(precision));
    return Math.ceil(num(v) * p) / p;
  },
  toFixed: (v: P, digits: P) => Number(num(v).toFixed(num(digits))),
  toPrecision: (v: P, precision: P) =>
    Number(num(v).toPrecision(num(precision))),
  incr: (v: P, by?: P) => num(v) + num(by ?? 1),
  decr: (v: P, by?: P) => num(v) - num(by ?? 1),
  wrap: (v: P, min: P, max: P) => {
    const nv = num(v);
    const nmin = num(min);
    const nmax = num(max);
    const range = nmax - nmin;
    if (range <= 0) return nmin;
    let result = nv - nmin;
    result = ((result % range) + range) % range;
    return result + nmin;
  },
  approach: (current: P, target: P, step: P) => {
    const c = num(current);
    const t = num(target);
    const s = Math.abs(num(step));
    if (c < t) return Math.min(c + s, t);
    if (c > t) return Math.max(c - s, t);
    return c;
  },
  moveToward: (current: P, target: P, maxDelta: P) => {
    const c = num(current);
    const t = num(target);
    const d = num(maxDelta);
    if (Math.abs(t - c) <= d) return t;
    return c + Math.sign(t - c) * d;
  },
  pingPong: (t: P, length: P) => {
    const time = num(t);
    const len = num(length);
    if (len <= 0) return 0;
    const cycles = Math.floor(time / len);
    const phase = time % len;
    return cycles % 2 === 0 ? phase : len - phase;
  },
  repeat: (t: P, length: P) => {
    const time = num(t);
    const len = num(length);
    if (len <= 0) return 0;
    return time - Math.floor(time / len) * len;
  },
  deltaAngle: (from: P, to: P) => {
    const a = num(from);
    const b = num(to);
    let delta = (b - a) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  },
  lerpAngle: (from: P, to: P, t: P) => {
    const a = num(from);
    const b = num(to);
    const nt = num(t);
    const delta = mathHelpers.deltaAngle(a, b) as number;
    return a + delta * nt;
  },
  smoothDamp: (
    current: P,
    target: P,
    velocity: P,
    smoothTime: P,
    deltaTime: P,
    maxSpeed?: P
  ) => {
    const c = num(current);
    const t = num(target);
    let v = num(velocity);
    const st = Math.max(0.0001, num(smoothTime));
    const dt = num(deltaTime);
    const ms = maxSpeed == null ? Infinity : num(maxSpeed);

    const omega = 2 / st;
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

    let change = c - t;
    const originalTo = t;

    const maxChange = ms * st;
    change = Math.max(-maxChange, Math.min(change, maxChange));
    const newTarget = c - change;

    const temp = (v + omega * change) * dt;
    v = (v - omega * temp) * exp;
    let output = newTarget + (change + temp) * exp;

    if (originalTo - c > 0 === output > originalTo) {
      output = originalTo;
      v = (output - originalTo) / dt;
    }

    return output;
  },
  remap: (v: P, fromMin: P, fromMax: P, toMin: P, toMax: P) => {
    const value = num(v);
    const fMin = num(fromMin);
    const fMax = num(fromMax);
    const tMin = num(toMin);
    const tMax = num(toMax);
    const fromRange = fMax - fMin;
    if (Math.abs(fromRange) < 0.000001) return tMin;
    const normalized = (value - fMin) / fromRange;
    return tMin + normalized * (tMax - tMin);
  },
  quantize: (v: P, step: P) => {
    const value = num(v);
    const s = num(step);
    if (s <= 0) return value;
    return Math.round(value / s) * s;
  },
  oscSine: (t: P, frequency?: P, amplitude?: P, phase?: P) => {
    const time = num(t);
    const freq = num(frequency ?? 1);
    const amp = num(amplitude ?? 1);
    const ph = num(phase ?? 0);
    return Math.sin((time * freq + ph) * 2 * Math.PI) * amp;
  },
  oscCos: (t: P, frequency?: P, amplitude?: P, phase?: P) => {
    const time = num(t);
    const freq = num(frequency ?? 1);
    const amp = num(amplitude ?? 1);
    const ph = num(phase ?? 0);
    return Math.cos((time * freq + ph) * 2 * Math.PI) * amp;
  },
  oscTriangle: (t: P, frequency?: P, amplitude?: P, phase?: P) => {
    const time = num(t);
    const freq = num(frequency ?? 1);
    const amp = num(amplitude ?? 1);
    const ph = num(phase ?? 0);
    const period = 1 / freq;
    const t2 = (time + ph) % period;
    const halfPeriod = period / 2;
    if (t2 < halfPeriod) {
      return ((t2 / halfPeriod) * 2 - 1) * amp;
    } else {
      return ((1 - (t2 - halfPeriod) / halfPeriod) * 2 - 1) * amp;
    }
  },
  oscSquare: (t: P, frequency?: P, amplitude?: P, phase?: P) => {
    const time = num(t);
    const freq = num(frequency ?? 1);
    const amp = num(amplitude ?? 1);
    const ph = num(phase ?? 0);
    const period = 1 / freq;
    const t2 = (time + ph) % period;
    return t2 < period / 2 ? amp : -amp;
  },
  oscSawtooth: (t: P, frequency?: P, amplitude?: P, phase?: P) => {
    const time = num(t);
    const freq = num(frequency ?? 1);
    const amp = num(amplitude ?? 1);
    const ph = num(phase ?? 0);
    const period = 1 / freq;
    const t2 = (time + ph) % period;
    return ((t2 / period) * 2 - 1) * amp;
  },
  easeInQuad: (t: P) => {
    const nt = num(t);
    return nt * nt;
  },
  easeOutQuad: (t: P) => {
    const nt = num(t);
    return nt * (2 - nt);
  },
  easeInOutQuad: (t: P) => {
    const nt = num(t);
    return nt < 0.5 ? 2 * nt * nt : -1 + (4 - 2 * nt) * nt;
  },
  easeInCubic: (t: P) => {
    const nt = num(t);
    return nt * nt * nt;
  },
  easeOutCubic: (t: P) => {
    const nt = num(t);
    const t1 = nt - 1;
    return t1 * t1 * t1 + 1;
  },
  easeInOutCubic: (t: P) => {
    const nt = num(t);
    return nt < 0.5
      ? 4 * nt * nt * nt
      : (nt - 1) * (2 * nt - 2) * (2 * nt - 2) + 1;
  },
  easeInElastic: (t: P) => {
    const nt = num(t);
    if (nt === 0) return 0;
    if (nt === 1) return 1;
    return -Math.pow(2, 10 * (nt - 1)) * Math.sin((nt - 1.1) * 5 * Math.PI);
  },
  easeOutElastic: (t: P) => {
    const nt = num(t);
    if (nt === 0) return 0;
    if (nt === 1) return 1;
    return Math.pow(2, -10 * nt) * Math.sin((nt - 0.1) * 5 * Math.PI) + 1;
  },
  easeInOutElastic: (t: P) => {
    const nt = num(t);
    if (nt === 0) return 0;
    if (nt === 1) return 1;
    if (nt < 0.5) {
      return (
        -0.5 *
        Math.pow(2, 20 * nt - 10) *
        Math.sin((20 * nt - 11.125) * ((2 * Math.PI) / 4.5))
      );
    }
    return (
      Math.pow(2, -20 * nt + 10) *
        Math.sin((20 * nt - 11.125) * ((2 * Math.PI) / 4.5)) *
        0.5 +
      1
    );
  },
  easeInBounce: (t: P) => {
    return 1 - (mathHelpers.easeOutBounce(1 - num(t)) as number);
  },
  easeOutBounce: (t: P) => {
    const nt = num(t);
    if (nt < 1 / 2.75) {
      return 7.5625 * nt * nt;
    } else if (nt < 2 / 2.75) {
      const t2 = nt - 1.5 / 2.75;
      return 7.5625 * t2 * t2 + 0.75;
    } else if (nt < 2.5 / 2.75) {
      const t2 = nt - 2.25 / 2.75;
      return 7.5625 * t2 * t2 + 0.9375;
    } else {
      const t2 = nt - 2.625 / 2.75;
      return 7.5625 * t2 * t2 + 0.984375;
    }
  },
  easeInOutBounce: (t: P) => {
    const nt = num(t);
    if (nt < 0.5) {
      return (mathHelpers.easeInBounce(nt * 2) as number) * 0.5;
    } else {
      return (mathHelpers.easeOutBounce(nt * 2 - 1) as number) * 0.5 + 0.5;
    }
  },
  decay: (current: P, rate: P, deltaTime: P) => {
    const c = num(current);
    const r = num(rate);
    const dt = num(deltaTime);
    return c * Math.pow(1 - r, dt);
  },
  decayToward: (current: P, target: P, rate: P, deltaTime: P) => {
    const c = num(current);
    const t = num(target);
    const r = num(rate);
    const dt = num(deltaTime);
    return t + (c - t) * Math.pow(1 - r, dt);
  },
  needsUpdate: (lastUpdate: P, interval: P, currentTime: P) => {
    const last = num(lastUpdate);
    const int = num(interval);
    const curr = num(currentTime);
    return curr - last >= int;
  },
  statInRange: (value: P, min: P, max: P) => {
    const v = num(value);
    const nmin = num(min);
    const nmax = num(max);
    return v >= nmin && v <= nmax;
  },
  statLevel: (value: P, thresholds: P[]) => {
    const v = num(value);
    const levels = toArr(thresholds)
      .map(num)
      .sort((a, b) => a - b);
    for (let i = levels.length - 1; i >= 0; i--) {
      if (v >= levels[i]) return i + 1;
    }
    return 0;
  },
  statPercent: (current: P, max: P) => {
    const c = num(current);
    const m = num(max);
    if (m <= 0) return 0;
    return Math.max(0, Math.min(1, c / m));
  },
  statCritical: (current: P, max: P, threshold?: P) => {
    const percent = mathHelpers.statPercent(current, max) as number;
    const thresh = num(threshold ?? 0.2);
    return percent <= thresh;
  },
  influence: (base: P, modifier: P, strength?: P) => {
    const b = num(base);
    const m = num(modifier);
    const s = num(strength ?? 1);
    return b + (m - b) * s;
  },
  multiInfluence: (base: P, modifiers: P[], weights?: P[]) => {
    const b = num(base);
    const mods = toArr(modifiers).map(num);
    const w = weights ? toArr(weights).map(num) : mods.map(() => 1);
    if (!mods.length) return b;

    let totalWeight = 0;
    let weightedSum = 0;
    for (let i = 0; i < mods.length; i++) {
      const weight = w[i] ?? 1;
      totalWeight += weight;
      weightedSum += mods[i] * weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : b;
  },
  diminishingReturns: (value: P, scale?: P, curve?: P) => {
    const v = num(value);
    const s = num(scale ?? 100);
    const c = num(curve ?? 2);
    return s * (1 - Math.pow(1 / (1 + v / s), c));
  },
  timeOfDay: (hours: P, minutes?: P) => {
    const h = num(hours) % 24;
    const m = num(minutes ?? 0) % 60;
    return h + m / 60;
  },
  isDayTime: (timeOfDay: P, sunrise?: P, sunset?: P) => {
    const tod = num(timeOfDay);
    const rise = num(sunrise ?? 6);
    const set = num(sunset ?? 18);
    return tod >= rise && tod < set;
  },
  seasonProgress: (dayOfYear: P, seasonLength?: P) => {
    const day = num(dayOfYear) % 365;
    const len = num(seasonLength ?? 91.25);
    return (day % len) / len;
  },
  getCurrentSeason: (dayOfYear: P) => {
    const day = num(dayOfYear) % 365;
    const seasonLength = 365 / 4;
    return Math.floor(day / seasonLength);
  },
  dailyReset: (lastReset: P, currentTime: P, resetHour?: P) => {
    const last = num(lastReset);
    const curr = num(currentTime);
    const hour = num(resetHour ?? 0);

    const lastDay = Math.floor(last / 86400);
    const currDay = Math.floor(curr / 86400);

    if (currDay > lastDay) {
      const currHour = (curr % 86400) / 3600;
      return currHour >= hour;
    }
    return false;
  },
  chance: (probability: P, roll?: P) => {
    const prob = num(probability);
    const r = roll == null ? Math.random() : num(roll);
    return r < prob;
  },
  weightedChance: (weights: P[], roll?: P) => {
    const w = toArr(weights).map(num);
    const r = roll == null ? Math.random() : num(roll);

    const total = w.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return -1;

    const normalized = r * total;
    let cumulative = 0;

    for (let i = 0; i < w.length; i++) {
      cumulative += w[i];
      if (normalized < cumulative) return i;
    }
    return w.length - 1;
  },
  rarityRoll: (baseChance: P, luck?: P, roll?: P) => {
    const base = num(baseChance);
    const l = num(luck ?? 0);
    const r = roll == null ? Math.random() : num(roll);

    const adjustedChance = base * (1 + l / 100);
    return r < adjustedChance;
  },
  statGrowth: (base: P, level: P, growthRate?: P, curve?: P) => {
    const b = num(base);
    const lvl = num(level);
    const rate = num(growthRate ?? 1.1);
    const c = num(curve ?? 1);

    return b * Math.pow(rate, Math.pow(lvl - 1, c));
  },
  expRequired: (level: P, baseExp?: P, exponent?: P) => {
    const lvl = num(level);
    const base = num(baseExp ?? 100);
    const exp = num(exponent ?? 1.5);

    return Math.floor(base * Math.pow(lvl, exp));
  },
  levelFromExp: (totalExp: P, baseExp?: P, exponent?: P) => {
    const exp = num(totalExp);
    const base = num(baseExp ?? 100);
    const e = num(exponent ?? 1.5);

    if (exp < base) return 1;
    return Math.floor(Math.pow(exp / base, 1 / e));
  },
  socialDecay: (
    relationship: P,
    lastInteraction: P,
    currentTime: P,
    decayRate?: P
  ) => {
    const rel = num(relationship);
    const last = num(lastInteraction);
    const curr = num(currentTime);
    const rate = num(decayRate ?? 0.01);

    const timePassed = curr - last;
    return Math.max(0, rel - timePassed * rate);
  },
  moodModifier: (mood: P, baseValue: P, moodImpact?: P) => {
    const m = num(mood);
    const base = num(baseValue);
    const impact = num(moodImpact ?? 0.2);

    const moodMultiplier = 1 + (m - 0.5) * impact * 2;
    return base * moodMultiplier;
  },
  needUrgency: (current: P, max: P, curve?: P) => {
    const c = num(current);
    const m = num(max);
    const crv = num(curve ?? 2);

    if (m <= 0) return 1;
    const ratio = c / m;
    return 1 - Math.pow(ratio, crv);
  },
  satisfactionCurve: (value: P, optimal: P, tolerance?: P) => {
    const v = num(value);
    const opt = num(optimal);
    const tol = num(tolerance ?? 0.5);

    const distance = Math.abs(v - opt);
    const normalizedDistance = distance / (opt * tol);

    return Math.max(0, 1 - normalizedDistance);
  },
  activityEnergy: (baseEnergy: P, fitness?: P, fatigue?: P) => {
    const base = num(baseEnergy);
    const fit = num(fitness ?? 0.5);
    const fat = num(fatigue ?? 0);

    const fitnessMultiplier = 0.5 + fit;
    const fatigueMultiplier = 1 - fat * 0.5;

    return base * fitnessMultiplier * fatigueMultiplier;
  },
  habitStrength: (repetitions: P, maxStrength?: P, growthRate?: P) => {
    const reps = num(repetitions);
    const max = num(maxStrength ?? 100);
    const rate = num(growthRate ?? 0.1);

    return max * (1 - Math.exp(-rate * reps));
  },
  skillProgress: (current: P, target: P, difficulty?: P, aptitude?: P) => {
    const c = num(current);
    const t = num(target);
    const diff = num(difficulty ?? 1);
    const apt = num(aptitude ?? 1);

    const gap = t - c;
    if (gap <= 0) return 0;

    const progressRate = apt / diff;
    return Math.min(gap, progressRate);
  },
  memoryFade: (initialStrength: P, timePassed: P, fadeRate?: P) => {
    const strength = num(initialStrength);
    const time = num(timePassed);
    const rate = num(fadeRate ?? 0.1);

    return strength * Math.exp(-rate * time);
  },
  crowdPressure: (crowdSize: P, maxPressure?: P, threshold?: P) => {
    const size = num(crowdSize);
    const max = num(maxPressure ?? 1);
    const thresh = num(threshold ?? 10);

    if (size <= 0) return 0;
    return max * (1 - Math.exp(-size / thresh));
  },
  comfortZone: (value: P, ideal: P, minComfort: P, maxComfort: P) => {
    const v = num(value);
    const i = num(ideal);
    const min = num(minComfort);
    const max = num(maxComfort);

    if (v < min || v > max) return 0;

    const distance = Math.abs(v - i);
    const range = Math.max(i - min, max - i);

    return 1 - distance / range;
  },
};

const EPOCH_1970 = 0;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const getDaysInMonth = (year: number, month: number): number => {
  if (month === 2) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 30;
};

const getYearFromTimestamp = (ts: number): number => {
  const days = Math.floor(ts / MS_PER_DAY);
  let year = 1970;
  let daysLeft = days;

  while (daysLeft >= 365) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const yearDays = isLeap ? 366 : 365;
    if (daysLeft >= yearDays) {
      daysLeft -= yearDays;
      year++;
    } else {
      break;
    }
  }
  return year;
};

const getMonthDayFromTimestamp = (
  ts: number
): { month: number; day: number } => {
  const year = getYearFromTimestamp(ts);
  const yearStart = getTimestampForYear(year);
  const daysSinceYearStart = Math.floor((ts - yearStart) / MS_PER_DAY);

  let month = 1;
  let daysLeft = daysSinceYearStart;

  while (month <= 12) {
    const daysInMonth = getDaysInMonth(year, month);
    if (daysLeft >= daysInMonth) {
      daysLeft -= daysInMonth;
      month++;
    } else {
      break;
    }
  }

  return { month, day: daysLeft + 1 };
};

const getTimestampForYear = (year: number): number => {
  let days = 0;
  for (let y = 1970; y < year; y++) {
    days += (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  }
  return days * MS_PER_DAY;
};

const createTimestamp = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): number => {
  const yearStart = getTimestampForYear(year);
  let dayOfYear = 0;

  for (let m = 1; m < month; m++) {
    dayOfYear += getDaysInMonth(year, m);
  }
  dayOfYear += day - 1;

  return (
    yearStart +
    dayOfYear * MS_PER_DAY +
    hour * MS_PER_HOUR +
    minute * MS_PER_MINUTE +
    second * MS_PER_SECOND
  );
};

export const dateNow = {
  current: () => new Date(),
};

export const dateHelpers: Record<string, (...args: any[]) => P> = {
  now: () => Date.now(),
  today: () => Math.floor(Date.now() / MS_PER_DAY),

  timestamp: (
    year?: P,
    month?: P,
    day?: P,
    hour?: P,
    minute?: P,
    second?: P
  ) => {
    if (typeof year === "undefined") return Date.now();
    const current = dateNow.current();
    const y = year == null ? current.getUTCFullYear() : num(year);
    const m = month == null ? current.getUTCMonth() + 1 : num(month);
    const d = day == null ? current.getUTCDate() : num(day);
    const h = hour == null ? current.getUTCHours() : num(hour);
    const min = minute == null ? current.getUTCMinutes() : num(minute);
    const s = second == null ? current.getUTCSeconds() : num(second);
    return createTimestamp(y, m, d, h, min, s);
  },

  year: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    return getYearFromTimestamp(ts);
  },

  month: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    return getMonthDayFromTimestamp(ts).month;
  },

  day: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    return getMonthDayFromTimestamp(ts).day;
  },

  hour: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    return Math.floor((ts % MS_PER_DAY) / MS_PER_HOUR);
  },

  minute: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    return Math.floor((ts % MS_PER_HOUR) / MS_PER_MINUTE);
  },

  second: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    return Math.floor((ts % MS_PER_MINUTE) / MS_PER_SECOND);
  },

  weekday: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const days = Math.floor(ts / MS_PER_DAY);
    return (days + 4) % 7;
  },

  weekdayName: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const weekday = (Math.floor(ts / MS_PER_DAY) + 4) % 7;
    return days[weekday];
  },

  monthName: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const month = getMonthDayFromTimestamp(ts).month;
    return months[month - 1] || "January";
  },

  daysUntil: (targetTimestamp: P, fromTimestamp?: P) => {
    const target = num(targetTimestamp);
    const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
    return Math.ceil((target - from) / MS_PER_DAY);
  },

  daysSince: (pastTimestamp: P, fromTimestamp?: P) => {
    const past = num(pastTimestamp);
    const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
    return Math.floor((from - past) / MS_PER_DAY);
  },

  hoursUntil: (targetTimestamp: P, fromTimestamp?: P) => {
    const target = num(targetTimestamp);
    const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
    return Math.ceil((target - from) / MS_PER_HOUR);
  },

  hoursSince: (pastTimestamp: P, fromTimestamp?: P) => {
    const past = num(pastTimestamp);
    const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
    return Math.floor((from - past) / MS_PER_HOUR);
  },

  minutesUntil: (targetTimestamp: P, fromTimestamp?: P) => {
    const target = num(targetTimestamp);
    const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
    return Math.ceil((target - from) / MS_PER_MINUTE);
  },

  minutesSince: (pastTimestamp: P, fromTimestamp?: P) => {
    const past = num(pastTimestamp);
    const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
    return Math.floor((from - past) / MS_PER_MINUTE);
  },

  addDays: (timestamp: P, days: P) => {
    const ts = num(timestamp);
    const d = num(days);
    return ts + d * MS_PER_DAY;
  },

  addHours: (timestamp: P, hours: P) => {
    const ts = num(timestamp);
    const h = num(hours);
    return ts + h * MS_PER_HOUR;
  },

  addMinutes: (timestamp: P, minutes: P) => {
    const ts = num(timestamp);
    const m = num(minutes);
    return ts + m * MS_PER_MINUTE;
  },

  startOfDay: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const dayStart = Math.floor(ts / MS_PER_DAY) * MS_PER_DAY;
    return dayStart;
  },

  endOfDay: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const dayStart = Math.floor(ts / MS_PER_DAY) * MS_PER_DAY;
    return dayStart + MS_PER_DAY - 1;
  },

  startOfWeek: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const days = Math.floor(ts / MS_PER_DAY);
    const weekday = (days + 4) % 7;
    const startDay = days - weekday;
    return startDay * MS_PER_DAY;
  },

  endOfWeek: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const days = Math.floor(ts / MS_PER_DAY);
    const weekday = (days + 4) % 7;
    const endDay = days + (6 - weekday);
    return endDay * MS_PER_DAY + MS_PER_DAY - 1;
  },

  startOfMonth: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const year = getYearFromTimestamp(ts);
    const month = getMonthDayFromTimestamp(ts).month;
    return createTimestamp(year, month, 1, 0, 0, 0);
  },

  endOfMonth: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const year = getYearFromTimestamp(ts);
    const month = getMonthDayFromTimestamp(ts).month;
    const daysInMonth = getDaysInMonth(year, month);
    return createTimestamp(year, month, daysInMonth, 23, 59, 59) + 999;
  },

  isWeekend: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const weekday = (Math.floor(ts / MS_PER_DAY) + 4) % 7;
    return weekday === 0 || weekday === 6;
  },

  isWeekday: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const weekday = (Math.floor(ts / MS_PER_DAY) + 4) % 7;
    return weekday >= 1 && weekday <= 5;
  },

  isSameDay: (timestamp1: P, timestamp2: P) => {
    const ts1 = num(timestamp1);
    const ts2 = num(timestamp2);
    const day1 = Math.floor(ts1 / MS_PER_DAY);
    const day2 = Math.floor(ts2 / MS_PER_DAY);
    return day1 === day2;
  },

  isSameWeek: (timestamp1: P, timestamp2: P) => {
    const ts1 = num(timestamp1);
    const ts2 = num(timestamp2);
    const start1 = dateHelpers.startOfWeek(ts1) as number;
    const start2 = dateHelpers.startOfWeek(ts2) as number;
    return start1 === start2;
  },

  isSameMonth: (timestamp1: P, timestamp2: P) => {
    const ts1 = num(timestamp1);
    const ts2 = num(timestamp2);
    const year1 = getYearFromTimestamp(ts1);
    const year2 = getYearFromTimestamp(ts2);
    const month1 = getMonthDayFromTimestamp(ts1).month;
    const month2 = getMonthDayFromTimestamp(ts2).month;
    return year1 === year2 && month1 === month2;
  },

  isBefore: (timestamp1: P, timestamp2: P) => {
    return num(timestamp1) < num(timestamp2);
  },

  isAfter: (timestamp1: P, timestamp2: P) => {
    return num(timestamp1) > num(timestamp2);
  },

  isBetween: (timestamp: P, start: P, end: P) => {
    const ts = num(timestamp);
    const s = num(start);
    const e = num(end);
    return ts >= s && ts <= e;
  },

  dayOfYear: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const year = getYearFromTimestamp(ts);
    const yearStart = getTimestampForYear(year);
    return Math.floor((ts - yearStart) / MS_PER_DAY) + 1;
  },

  weekOfYear: (timestamp?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const year = getYearFromTimestamp(ts);
    const yearStart = getTimestampForYear(year);
    const days = Math.floor((ts - yearStart) / MS_PER_DAY);
    const jan1Weekday = (Math.floor(yearStart / MS_PER_DAY) + 4) % 7;
    return Math.ceil((days + jan1Weekday + 1) / 7);
  },

  isLeapYear: (year?: P) => {
    const y = year == null ? getYearFromTimestamp(Date.now()) : num(year);
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  },

  daysInMonth: (year?: P, month?: P) => {
    const currentTs = Date.now();
    const y = year == null ? getYearFromTimestamp(currentTs) : num(year);
    const m =
      month == null ? getMonthDayFromTimestamp(currentTs).month : num(month);
    return getDaysInMonth(y, m);
  },

  formatDate: (timestamp?: P, format?: P) => {
    const ts = timestamp == null ? Date.now() : num(timestamp);
    const fmt = format == null ? "YYYY-MM-DD" : toStr(format);

    const year = getYearFromTimestamp(ts);
    const { month, day } = getMonthDayFromTimestamp(ts);
    const hour = Math.floor((ts % MS_PER_DAY) / MS_PER_HOUR);
    const minute = Math.floor((ts % MS_PER_HOUR) / MS_PER_MINUTE);
    const second = Math.floor((ts % MS_PER_MINUTE) / MS_PER_SECOND);

    const replacements: Record<string, string> = {
      YYYY: year.toString(),
      MM: month.toString().padStart(2, "0"),
      DD: day.toString().padStart(2, "0"),
      HH: hour.toString().padStart(2, "0"),
      mm: minute.toString().padStart(2, "0"),
      ss: second.toString().padStart(2, "0"),
    };

    let result = fmt;
    for (const [pattern, replacement] of Object.entries(replacements)) {
      result = result.replace(new RegExp(pattern, "g"), replacement);
    }
    return result;
  },

  parseDate: (dateString: P) => {
    const str = toStr(dateString);
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = str.split("-").map(Number);
      return createTimestamp(year, month, day, 0, 0, 0);
    }
    if (str.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      const [datePart, timePart] = str.split(" ");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute, second] = timePart.split(":").map(Number);
      return createTimestamp(year, month, day, hour, minute, second);
    }
    return null;
  },

  timeSince: (pastTimestamp: P, fromTimestamp?: P) => {
    const past = num(pastTimestamp);
    const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
    const diff = from - past;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  },

  timeUntil: (futureTimestamp: P, fromTimestamp?: P) => {
    const future = num(futureTimestamp);
    const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
    const diff = future - from;

    if (diff <= 0) return "now";

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
    if (hours > 0) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
    if (minutes > 0) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
    return `in ${seconds} second${seconds === 1 ? "" : "s"}`;
  },

  msToDecimalHours: (ms: P) => {
    const milliseconds = num(ms);
    return milliseconds / 3600000;
  },

  decimalHoursToClock: (hours: P) => {
    const h = Math.trunc(num(hours));
    const m = Math.round((Math.abs(num(hours)) % 1) * 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  },
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

export function buildDefaultFuncs(
  funcs: Record<string, ExprEvalFunc> = {},
  prng: PRNG
) {
  const randomHelpers = createRandomHelpers(prng);
  return Object.assign(
    arrayHelpers,
    stringHelpers,
    unifiedHelpers,
    mathHelpers,
    dateHelpers,
    randomHelpers,
    funcs
  );
}
