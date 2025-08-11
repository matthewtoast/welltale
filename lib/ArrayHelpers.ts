import { PRNG } from "./RandHelpers";

export const paginateArray = <T>(array: T[], pageSize: number): T[][] => {
  return Array.from({ length: Math.ceil(array.length / pageSize) }, (_, i) =>
    array.slice(i * pageSize, i * pageSize + pageSize)
  );
};

export function containsAll(s: string, xs: string[]) {
  if (xs.length < 1) {
    return false;
  }
  return xs.filter((x) => s.includes(x)).length === xs.length;
}

export function batchArray<T>(array: T[], batchSize: number): T[][] {
  if (batchSize <= 0) throw new Error("Batch size must be greater than zero.");
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    result.push(array.slice(i, i + batchSize));
  }
  return result;
}

export function shuffleByBatchSizes<T>(
  rng: PRNG,
  array: T[],
  ...batchSizes: number[]
): T[] {
  const arr = array.slice();
  let start = 0;
  let i = 0;

  // Go through the provided batch sizes first
  for (; i < batchSizes.length && start < arr.length; i++) {
    const size = batchSizes[i];
    const end = Math.min(start + size, arr.length);
    for (let j = end - 1; j > start; j--) {
      const k = Math.floor(rng.next() * (j - start + 1)) + start;
      [arr[j], arr[k]] = [arr[k], arr[j]];
    }
    start = end;
  }

  // If we haven't reached the end of the array, use the last batch size repeatedly
  if (start < arr.length) {
    const lastBatchSize = batchSizes[batchSizes.length - 1] || arr.length;
    while (start < arr.length) {
      const end = Math.min(start + lastBatchSize, arr.length);
      for (let j = end - 1; j > start; j--) {
        const k = Math.floor(rng.next() * (j - start + 1)) + start;
        [arr[j], arr[k]] = [arr[k], arr[j]];
      }
      start = end;
    }
  }

  return arr;
}

export function createArray<T>(length: number, fillValue: T): T[] {
  return Array.from({ length }, () => fillValue);
}

export function getElementsAfterLastOccurrence<T>(
  array: T[],
  predicate: (e: T) => boolean
): T[] {
  const index = array.findLastIndex(predicate);
  return index === -1 ? [] : array.slice(index + 1);
}

export function getElementsStartingWithLastOccurrence<T>(
  array: T[],
  predicate: (e: T) => boolean
): T[] {
  const index = array.findLastIndex(predicate);
  return index === -1 ? [] : array.slice(index);
}

export function indexToCombination<T>(items: T[][], index: number): T[] {
  if (index < 0 || !Number.isInteger(index)) {
    return [];
  }
  const result: T[] = [];
  let divisor = 1;
  for (let i = items.length - 1; i >= 0; i--) {
    const choices = items[i];
    const idx = Math.floor(index / divisor) % choices.length;
    result.unshift(choices[idx]);
    divisor *= choices.length;
  }
  return result;
}

export function combinationToIndex(items: any[][], combination: any[]): number {
  if (combination.length !== items.length) return -1;
  let index = 0;
  let multiplier = 1;
  for (let i = items.length - 1; i >= 0; i--) {
    const choices = items[i];
    const choiceIndex = choices.indexOf(combination[i]);
    if (choiceIndex === -1) return -1; // not found
    index += choiceIndex * multiplier;
    multiplier *= choices.length;
  }
  return index;
}

export function feistel(index: number, rounds: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  if (index < 0 || !Number.isInteger(index)) {
    return 0;
  }
  let l = index >>> 16;
  let r = index & 0xffff;
  for (let i = 0; i < rounds; i++) {
    const newL = r;
    const f = ((r * 1103515245 + 12345) >>> 0) & 0xffff;
    const newR = l ^ f;
    l = newL;
    r = newR;
  }
  const mixed = ((l << 16) | r) >>> 0;
  return mixed % max;
}

export function feistelEncrypt(index: number, rounds: number): number {
  let l = index >>> 16;
  let r = index & 0xffff;
  for (let i = 0; i < rounds; i++) {
    const f = ((r * 1103515245 + 12345 + i) >>> 0) & 0xffff;
    const newL = r;
    const newR = l ^ f;
    l = newL;
    r = newR;
  }
  return ((l << 16) | r) >>> 0;
}

export function feistelDecrypt(value: number, rounds: number): number {
  let l = value >>> 16;
  let r = value & 0xffff;
  for (let i = rounds - 1; i >= 0; i--) {
    const f = ((l * 1103515245 + 12345 + i) >>> 0) & 0xffff;
    const newR = l;
    const newL = r ^ f;
    l = newL;
    r = newR;
  }
  return ((l << 16) | r) >>> 0;
}

export function fill<T>(len: number, value: T): T[] {
  return Array.from({ length: len }, () => value);
}

export const getWeightedElement = <T>(
  arr: T[],
  index: number,
  mod: number = 9973
): T => {
  const weights = arr.map((_, i) => 1 / 2 ** i);
  const total = weights.reduce((a, b) => a + b, 0);
  const scaled = ((index % mod) / mod) * total;
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (scaled <= sum) return arr[i];
  }
  return arr[arr.length - 1];
};

export function oddElements<T>(array: T[]): T[] {
  return array.filter((_, index) => index % 2 === 1);
}

export function evenElements<T>(array: T[]): T[] {
  return array.filter((_, index) => index % 2 === 0);
}
