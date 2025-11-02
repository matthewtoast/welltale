import {
  A,
  cmp,
  eq,
  flatDeep,
  MethodDef,
  num,
  P,
  toArr,
  uniq,
} from "./MethodHelpers";

export const arrayHelpers: Record<string, MethodDef> = {
  first: {
    doc: `Returns the first element of the array, else null`,
    ex: `wsl.first([1,2,3]) // => 1`,
    fn: (a: A) => toArr(a)[0] ?? null,
  },
  last: {
    doc: `Returns the last element of the array, else null`,
    ex: `wsl.last([1,2,3]) // => 3`,
    fn: (a: A) => {
      const t = toArr(a);
      return t[t.length - 1] ?? null;
    },
  },
  nth: {
    doc: `Returns the nth element of the array, else null`,
    ex: `wsl.nth([1,2,3], 1) // => 2`,
    fn: (a: A, i: P) => toArr(a)[num(i) | 0] ?? null,
  },
  take: {
    doc: `Returns the first n elements of the array`,
    ex: `wsl.take([1,2,3,4], 2) // => [1,2]`,
    fn: (a: A, n: P) => toArr(a).slice(0, num(n) | 0),
  },
  drop: {
    doc: `Returns the array with the first n elements removed`,
    ex: `wsl.drop([1,2,3,4], 2) // => [3,4]`,
    fn: (a: A, n: P) => toArr(a).slice(num(n) | 0),
  },
  sortDesc: {
    doc: `Returns the array sorted in descending order`,
    ex: `wsl.sortDesc([3,1,2]) // => [3,2,1]`,
    fn: (a: A) =>
      toArr(a)
        .slice()
        .sort((x, y) => -cmp(x, y)),
  },
  uniq: {
    doc: `Returns the array with duplicate values removed`,
    ex: `wsl.uniq([1,2,2,3]) // => [1,2,3]`,
    fn: (a: A) => uniq(toArr(a)),
  },
  flatten: {
    doc: `Returns the array flattened one level deep`,
    ex: `wsl.flatten([1,[2,3],4]) // => [1,2,3,4]`,
    fn: (a: A) =>
      toArr(a).reduce<P[]>((r, v) => r.concat(Array.isArray(v) ? v : [v]), []),
  },
  flattenDeep: {
    doc: `Returns the array flattened to the specified depth`,
    ex: `wsl.flattenDeep([1,[2,[3]]], 2) // => [1,2,3]`,
    fn: (a: A, depth?: P) =>
      flatDeep(toArr(a) as any[], depth == null ? 1 / 0 : num(depth) | 0),
  },
  contains: {
    doc: `Returns true if the array contains the value`,
    ex: `wsl.contains([1,2,3], 2) // => true`,
    fn: (a: A, v: A) => toArr(a).some((x) => eq(x, v)),
  },
  count: {
    doc: `Returns the number of times the value appears in the array`,
    ex: `wsl.count([1,2,2,3], 2) // => 2`,
    fn: (a: A, v: A) =>
      toArr(a).reduce((c, x) => (c as number) + (eq(x, v) ? 1 : 0), 0),
  },
  compact: {
    doc: `Returns the array with falsy values removed`,
    ex: `wsl.compact([1,0,2,null,3]) // => [1,2,3]`,
    fn: (a: A) => toArr(a).filter((x) => !!x),
  },
  sum: {
    doc: `Returns the sum of all numeric values in the array`,
    ex: `wsl.sum([1,2,3]) // => 6`,
    fn: (a: A) => toArr(a).reduce((s, x) => (s as number) + num(x ?? 0), 0),
  },
  mean: {
    doc: `Returns the arithmetic mean of all numeric values in the array`,
    ex: `wsl.mean([1,2,3]) // => 2`,
    fn: (a: A) => {
      const t = toArr(a);
      return t.length
        ? (t.reduce((s, x) => (s as number) + num(x ?? 0), 0) as number) /
            t.length
        : 0;
    },
  },
  median: {
    doc: `Returns the median value of the array`,
    ex: `wsl.median([1,2,3]) // => 2`,
    fn: (a: A) => {
      const t = toArr(a).slice().sort(cmp);
      const n = t.length;
      if (!n) return null;
      return n % 2 ? t[(n - 1) / 2] : (num(t[n / 2 - 1]) + num(t[n / 2])) / 2;
    },
  },
  sumBy: {
    doc: `Returns the sum of values at the specified index or property`,
    ex: `wsl.sumBy([[1,2],[3,4]], 1) // => 6`,
    fn: (a: A, k: P) =>
      toArr(a).reduce(
        (s, x) =>
          (s as number) +
          num(Array.isArray(x) ? ((x[num(k ?? 0) | 0] as P) ?? 0) : (x ?? 0)),
        0
      ),
  },
  mapAdd: {
    doc: `Returns the array with each number incremented by n`,
    ex: `wsl.mapAdd([1,2,3], 10) // => [11,12,13]`,
    fn: (a: A, n: P) => toArr(a).map((x) => num(x) + num(n)),
  },
  mapSub: {
    doc: `Returns the array with each number decremented by n`,
    ex: `wsl.mapSub([11,12,13], 10) // => [1,2,3]`,
    fn: (a: A, n: P) => toArr(a).map((x) => num(x) - num(n)),
  },
  mapMul: {
    doc: `Returns the array with each number multiplied by n`,
    ex: `wsl.mapMul([1,2,3], 2) // => [2,4,6]`,
    fn: (a: A, n: P) => toArr(a).map((x) => num(x) * num(n)),
  },
  mapDiv: {
    doc: `Returns the array with each number divided by n`,
    ex: `wsl.mapDiv([2,4,6], 2) // => [1,2,3]`,
    fn: (a: A, n: P) => toArr(a).map((x) => num(x) / num(n)),
  },
  union: {
    doc: `Returns the union of two arrays with duplicates removed`,
    ex: `wsl.union([1,2], [2,3]) // => [1,2,3]`,
    fn: (a: A, b: A) => uniq(toArr(a).concat(toArr(b))),
  },
  intersection: {
    doc: `Returns the intersection of two arrays`,
    ex: `wsl.intersection([1,2,3], [2,3,4]) // => [2,3]`,
    fn: (a: A, b: A) => {
      const tb = toArr(b);
      return uniq(toArr(a).filter((x) => tb.some((y) => eq(x, y))));
    },
  },
  difference: {
    doc: `Returns elements in the first array that are not in the second`,
    ex: `wsl.difference([1,2,3], [2,3,4]) // => [1]`,
    fn: (a: A, b: A) => {
      const tb = toArr(b);
      return toArr(a).filter((x) => !tb.some((y) => eq(x, y)));
    },
  },
};
