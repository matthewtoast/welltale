import { gcd } from "mathjs";

const P = 2305843009213693951n;

const A = 7919n;
const B = 104729n;
const C = 1299709n;
const D = 15485863n;
const E = 179424673n;

const modinv = (a: bigint, m: bigint): bigint => {
  let [t, newT] = [0n, 1n];
  let [r, newR] = [m, a];
  while (newR !== 0n) {
    const q = r / newR;
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }
  return (t + m) % m;
};

const invA = modinv(A, P);
const invB = modinv(B, P);
const invC = modinv(C, P);
const invD = modinv(D, P);
const invE = modinv(E, P);

export const f2 = (x: bigint, y: bigint) => (x * A + y * B) % P;

export const solveF2 = (result: bigint, x: bigint | null, y: bigint | null) => {
  if (x === null) return ((result - y! * B + P) * invA) % P;
  if (y === null) return ((result - x * A + P) * invB) % P;
  return 0n;
};

export const f3 = (x: bigint, y: bigint, z: bigint) => (x * A + y * B + z * C) % P;

export const solveF3 = (result: bigint, x: bigint | null, y: bigint | null, z: bigint | null) => {
  if (x === null) return ((result - y! * B - z! * C + P) * invA) % P;
  if (y === null) return ((result - x * A - z! * C + P) * invB) % P;
  if (z === null) return ((result - x * A - y * B + P) * invC) % P;
  return 0n;
};

export const f4 = (x: bigint, y: bigint, z: bigint, w: bigint) => (x * A + y * B + z * C + w * D) % P;

export const solveF4 = (result: bigint, x: bigint | null, y: bigint | null, z: bigint | null, w: bigint | null) => {
  if (x === null) return ((result - y! * B - z! * C - w! * D + P) * invA) % P;
  if (y === null) return ((result - x * A - z! * C - w! * D + P) * invB) % P;
  if (z === null) return ((result - x * A - y * B - w! * D + P) * invC) % P;
  if (w === null) return ((result - x * A - y * B - z! * C + P) * invD) % P;
  return 0n;
};

export const f5 = (x: bigint, y: bigint, z: bigint, w: bigint, v: bigint) => (x * A + y * B + z * C + w * D + v * E) % P;

export const solveF5 = (result: bigint, x: bigint | null, y: bigint | null, z: bigint | null, w: bigint | null, v: bigint | null) => {
  if (x === null) return ((result - y! * B - z! * C - w! * D - v! * E + P) * invA) % P;
  if (y === null) return ((result - x * A - z! * C - w! * D - v! * E + P) * invB) % P;
  if (z === null) return ((result - x * A - y! * B - w! * D - v! * E + P) * invC) % P;
  if (w === null) return ((result - x * A - y! * B - z! * C - v! * E + P) * invD) % P;
  if (v === null) return ((result - x * A - y! * B - z! * C - w! * D + P) * invE) % P;
  return 0n;
};

// f(x) = ((x - 4) * 1 + 3) % 7 + 4

export const coprimesOf = (n: number) => Array.from({ length: n - 1 }, (_, i) => i + 1).filter((x) => gcd(x, n) === 1);

export const jumpDet = (x: number, l: number, r: number, b: number) => {
  const n = r - l;
  const a = coprimesOf(n)[0];
  return (a * x + b) % n;
};
