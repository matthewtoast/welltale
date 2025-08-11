import { hash32 } from "./MathHelpers";

export function noiseSimple(seed: number): number {
  // Use a simple hash function to generate a pseudo-random value
  let x = Math.sin(seed * 12.9898) * 43758.5453;
  x = x - Math.floor(x); // keep fractional part [0,1)
  return x; // returns a value between 0 and 1
}

export function noise1D(x: number, seed: number = 0): number {
  const hashedX = hash32(Math.floor(x) + seed);
  const frac = x - Math.floor(x);
  const a = (hashedX & 0xffff) / 0xffff;
  const b = ((hashedX >>> 16) & 0xffff) / 0xffff;
  // Smooth interpolation between grid points
  const t = frac * frac * (3 - 2 * frac); // smoothstep
  return a + t * (b - a);
}

export function fractalNoise1D(x: number, octaves: number = 4, persistence: number = 0.5, seed: number = 0): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise1D(x * frequency, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return value / maxValue; // Normalize to [0, 1]
}

// Simple 2D noise
export function noise2D(x: number, y: number, seed: number = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Hash the four corners
  const a = hash32(ix + seed) ^ hash32(iy + seed * 31);
  const b = hash32(ix + 1 + seed) ^ hash32(iy + seed * 31);
  const c = hash32(ix + seed) ^ hash32(iy + 1 + seed * 31);
  const d = hash32(ix + 1 + seed) ^ hash32(iy + 1 + seed * 31);

  // Convert to [0, 1]
  const va = (a & 0xffff) / 0xffff;
  const vb = (b & 0xffff) / 0xffff;
  const vc = (c & 0xffff) / 0xffff;
  const vd = (d & 0xffff) / 0xffff;

  // Smooth interpolation
  const tx = fx * fx * (3 - 2 * fx);
  const ty = fy * fy * (3 - 2 * fy);

  const top = va + tx * (vb - va);
  const bottom = vc + tx * (vd - vc);

  return top + ty * (bottom - top);
}

export function fractalNoise2D(x: number, y: number, octaves: number, persistence: number, seed: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return value / maxValue;
}

export function warpedNoise(x: number, y: number, warpStrength: number = 0.1, seed: number = 0): number {
  const warpX = x + warpStrength * noise2D(x + 100, y + 100, seed);
  const warpY = y + warpStrength * noise2D(x + 200, y + 200, seed + 1);
  const result = noise2D(warpX, warpY, seed + 2);
  // Ensure we stay in [0, 1] range
  return Math.max(0, Math.min(1, result));
}

export function noise1DInRange(x: number, min: number, max: number, seed: number = 0): number {
  const noiseValue = noise1D(x, seed); // Get noise in [0, 1]
  return min + noiseValue * (max - min); // Map to [min, max]
}

export function noise2DInRange(x: number, y: number, min: number, max: number, seed: number = 0): number {
  const noiseValue = noise2D(x, y, seed); // Get noise in [0, 1]
  return min + noiseValue * (max - min); // Map to [min, max]
}

export function fractalNoiseInRange(x: number, min: number, max: number, octaves: number = 4, persistence: number = 0.5, seed: number = 0): number {
  const noiseValue = fractalNoise1D(x, octaves, persistence, seed); // Get noise in [0, 1]
  return min + noiseValue * (max - min); // Map to [min, max]
}
