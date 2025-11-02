import { MethodDef, num, P } from "./MethodHelpers";

export const mathHelpers: Record<string, MethodDef> = {
  clamp: {
    doc: "Returns number clamped within the given min, max range",
    ex: "wsl.clamp(13, 0, 10) // => 10",
    fn: (v: P, min: P, max: P) =>
      Math.max(num(min), Math.min(num(max), num(v))),
  },
  avg: {
    doc: "Returns the average of the given numbers",
    ex: "wsl.avg(1, 2, 3, 4) // => 2.5",
    fn: (...args: P[]) => {
      if (!args.length) return 0;
      return args.reduce<number>((s, x) => s + num(x), 0) / args.length;
    },
  },
  average: {
    doc: "Returns the average of the given numbers",
    ex: "wsl.average(1, 2, 3, 4) // => 2.5",
    fn: (...args: P[]) => {
      if (!args.length) return 0;
      return args.reduce<number>((s, x) => s + num(x), 0) / args.length;
    },
  },
  gcd: {
    doc: "Returns the greatest common divisor of two numbers",
    ex: "wsl.gcd(12, 8) // => 4",
    fn: (a: P, b: P) => {
      let x = Math.abs(num(a));
      let y = Math.abs(num(b));
      while (y) {
        const t = y;
        y = x % y;
        x = t;
      }
      return x;
    },
  },
  lcm: {
    doc: "Returns the least common multiple of two numbers",
    ex: "wsl.lcm(4, 6) // => 12",
    fn: (a: P, b: P) => {
      const na = num(a),
        nb = num(b);
      return Math.abs(na * nb) / (mathHelpers.gcd.fn(na, nb) as number);
    },
  },
  factorial: {
    doc: "Returns the factorial of a number",
    ex: "wsl.factorial(5) // => 120",
    fn: (n: P) => {
      const v = Math.floor(num(n));
      if (v < 0) return NaN;
      if (v === 0 || v === 1) return 1;
      let result = 1;
      for (let i = 2; i <= v; i++) result *= i;
      return result;
    },
  },
  nCr: {
    doc: "Returns the number of combinations (n choose r)",
    ex: "wsl.nCr(5, 2) // => 10",
    fn: (n: P, r: P) => {
      const nn = Math.floor(num(n));
      const rr = Math.floor(num(r));
      if (rr > nn || rr < 0) return 0;
      return (
        (mathHelpers.factorial.fn(nn) as number) /
        ((mathHelpers.factorial.fn(rr) as number) *
          (mathHelpers.factorial.fn(nn - rr) as number))
      );
    },
  },
  nPr: {
    doc: "Returns the number of permutations (n permute r)",
    ex: "wsl.nPr(5, 2) // => 20",
    fn: (n: P, r: P) => {
      const nn = Math.floor(num(n));
      const rr = Math.floor(num(r));
      if (rr > nn || rr < 0) return 0;
      return (
        (mathHelpers.factorial.fn(nn) as number) /
        (mathHelpers.factorial.fn(nn - rr) as number)
      );
    },
  },
  degToRad: {
    doc: "Converts degrees to radians",
    ex: "wsl.degToRad(180) // => 3.14159",
    fn: (deg: P) => num(deg) * (Math.PI / 180),
  },
  radToDeg: {
    doc: "Converts radians to degrees",
    ex: "wsl.radToDeg(3.14159) // => 180",
    fn: (rad: P) => num(rad) * (180 / Math.PI),
  },
  lerp: {
    doc: "Linear interpolation between two values",
    ex: "wsl.lerp(0, 10, 0.5) // => 5",
    fn: (a: P, b: P, t: P) => {
      const na = num(a);
      const nb = num(b);
      const nt = num(t);
      return na + (nb - na) * nt;
    },
  },
  inverseLerp: {
    doc: "Returns the interpolation factor for a value between two bounds",
    ex: "wsl.inverseLerp(0, 10, 5) // => 0.5",
    fn: (a: P, b: P, v: P) => {
      const na = num(a);
      const nb = num(b);
      const nv = num(v);
      return (nv - na) / (nb - na);
    },
  },
  map: {
    doc: "Maps a value from one range to another",
    ex: "wsl.map(5, 0, 10, 0, 100) // => 50",
    fn: (v: P, inMin: P, inMax: P, outMin: P, outMax: P) => {
      const nv = num(v);
      const t = (nv - num(inMin)) / (num(inMax) - num(inMin));
      return num(outMin) + t * (num(outMax) - num(outMin));
    },
  },
  smoothstep: {
    doc: "Smooth interpolation with ease-in-out curve",
    ex: "wsl.smoothstep(0, 1, 0.5) // => 0.5",
    fn: (edge0: P, edge1: P, x: P) => {
      const t = mathHelpers.clamp.fn(
        (num(x) - num(edge0)) / (num(edge1) - num(edge0)),
        0,
        1
      );
      const nt = num(t as P);
      return nt * nt * (3 - 2 * nt);
    },
  },
  step: {
    doc: "Returns 0 if x < edge, otherwise 1",
    ex: "wsl.step(5, 3) // => 0",
    fn: (edge: P, x: P) => (num(x) < num(edge) ? 0 : 1),
  },
  fract: {
    doc: "Returns the fractional part of a number",
    ex: "wsl.fract(3.14) // => 0.14",
    fn: (v: P) => {
      const n = num(v);
      return n - Math.floor(n);
    },
  },
  isPrime: {
    doc: "Returns true if the number is prime",
    ex: "wsl.isPrime(7) // => true",
    fn: (n: P) => {
      const v = Math.floor(num(n));
      if (v <= 1) return false;
      if (v <= 3) return true;
      if (v % 2 === 0 || v % 3 === 0) return false;
      for (let i = 5; i * i <= v; i += 6) {
        if (v % i === 0 || v % (i + 2) === 0) return false;
      }
      return true;
    },
  },
  variance: {
    doc: "Returns the variance of the given numbers",
    ex: "wsl.variance(1, 2, 3, 4, 5) // => 2",
    fn: (...args: P[]) => {
      if (!args.length) return 0;
      const mean = mathHelpers.avg.fn(...args) as number;
      return (
        args.reduce<number>((s, x) => {
          const d = num(x) - mean;
          return s + d * d;
        }, 0) / args.length
      );
    },
  },
  stdDev: {
    doc: "Returns the standard deviation of the given numbers",
    ex: "wsl.stdDev(1, 2, 3, 4, 5) // => 1.414",
    fn: (...args: P[]) => Math.sqrt(mathHelpers.variance.fn(...args) as number),
  },
  standardDeviation: {
    doc: "Returns the standard deviation of the given numbers",
    ex: "wsl.standardDeviation(1, 2, 3, 4, 5) // => 1.414",
    fn: (...args: P[]) => Math.sqrt(mathHelpers.variance.fn(...args) as number),
  },
  distance: {
    doc: "Returns the Euclidean distance between two points",
    ex: "wsl.distance(0, 0, 3, 4) // => 5",
    fn: (x1: P, y1: P, x2: P, y2: P) =>
      Math.hypot(num(x2) - num(x1), num(y2) - num(y1)),
  },
  manhattan: {
    doc: "Returns the Manhattan distance between two points",
    ex: "wsl.manhattan(0, 0, 3, 4) // => 7",
    fn: (x1: P, y1: P, x2: P, y2: P) =>
      Math.abs(num(x2) - num(x1)) + Math.abs(num(y2) - num(y1)),
  },
  normalize: {
    doc: "Normalizes a value to a 0-1 range",
    ex: "wsl.normalize(5, 0, 10) // => 0.5",
    fn: (v: P, min: P, max: P) => (num(v) - num(min)) / (num(max) - num(min)),
  },
  denormalize: {
    doc: "Converts a normalized value back to the original range",
    ex: "wsl.denormalize(0.5, 0, 10) // => 5",
    fn: (v: P, min: P, max: P) => num(v) * (num(max) - num(min)) + num(min),
  },
  roundTo: {
    doc: "Rounds a number to the specified precision",
    ex: "wsl.roundTo(3.14159, 2) // => 3.14",
    fn: (v: P, precision: P) => {
      const p = Math.pow(10, num(precision));
      return Math.round(num(v) * p) / p;
    },
  },
  floorTo: {
    doc: "Floors a number to the specified precision",
    ex: "wsl.floorTo(3.14159, 2) // => 3.14",
    fn: (v: P, precision: P) => {
      const p = Math.pow(10, num(precision));
      return Math.floor(num(v) * p) / p;
    },
  },
  ceilTo: {
    doc: "Ceils a number to the specified precision",
    ex: "wsl.ceilTo(3.14159, 2) // => 3.15",
    fn: (v: P, precision: P) => {
      const p = Math.pow(10, num(precision));
      return Math.ceil(num(v) * p) / p;
    },
  },
  incr: {
    doc: "Increments a number by the specified amount",
    ex: "wsl.incr(5, 2) // => 7",
    fn: (v: P, by?: P) => num(v) + num(by ?? 1),
  },
  decr: {
    doc: "Decrements a number by the specified amount",
    ex: "wsl.decr(5, 2) // => 3",
    fn: (v: P, by?: P) => num(v) - num(by ?? 1),
  },
  wrap: {
    doc: "Wraps a value within the specified range",
    ex: "wsl.wrap(12, 0, 10) // => 2",
    fn: (v: P, min: P, max: P) => {
      const nv = num(v);
      const nmin = num(min);
      const nmax = num(max);
      const range = nmax - nmin;
      if (range <= 0) return nmin;
      let result = nv - nmin;
      result = ((result % range) + range) % range;
      return result + nmin;
    },
  },
  approach: {
    doc: "Moves a value toward a target by a fixed step",
    ex: "wsl.approach(5, 10, 2) // => 7",
    fn: (current: P, target: P, step: P) => {
      const c = num(current);
      const t = num(target);
      const s = Math.abs(num(step));
      if (c < t) return Math.min(c + s, t);
      if (c > t) return Math.max(c - s, t);
      return c;
    },
  },
  moveToward: {
    doc: "Moves a value toward a target with maximum delta",
    ex: "wsl.moveToward(5, 10, 2) // => 7",
    fn: (current: P, target: P, maxDelta: P) => {
      const c = num(current);
      const t = num(target);
      const d = num(maxDelta);
      if (Math.abs(t - c) <= d) return t;
      return c + Math.sign(t - c) * d;
    },
  },
  pingPong: {
    doc: "Creates a ping-pong pattern that bounces between 0 and length",
    ex: "wsl.pingPong(3, 2) // => 1",
    fn: (t: P, length: P) => {
      const time = num(t);
      const len = num(length);
      if (len <= 0) return 0;
      const cycles = Math.floor(time / len);
      const phase = time % len;
      return cycles % 2 === 0 ? phase : len - phase;
    },
  },
  repeat: {
    doc: "Repeats a value within the specified length",
    ex: "wsl.repeat(3.5, 2) // => 1.5",
    fn: (t: P, length: P) => {
      const time = num(t);
      const len = num(length);
      if (len <= 0) return 0;
      return time - Math.floor(time / len) * len;
    },
  },
  quantize: {
    doc: "Quantizes a value to the nearest step increment",
    ex: "wsl.quantize(7.3, 2) // => 8",
    fn: (v: P, step: P) => {
      const value = num(v);
      const s = num(step);
      if (s <= 0) return value;
      return Math.round(value / s) * s;
    },
  },
  oscSine: {
    doc: "Generates a sine wave oscillation",
    ex: "wsl.oscSine(0.25, 1, 2) // => 2",
    fn: (t: P, frequency?: P, amplitude?: P, phase?: P) => {
      const time = num(t);
      const freq = num(frequency ?? 1);
      const amp = num(amplitude ?? 1);
      const ph = num(phase ?? 0);
      return Math.sin((time * freq + ph) * 2 * Math.PI) * amp;
    },
  },
  oscTriangle: {
    doc: "Generates a triangle wave oscillation",
    ex: "wsl.oscTriangle(0.5, 1, 2) // => -2",
    fn: (t: P, frequency?: P, amplitude?: P, phase?: P) => {
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
  },
  oscSquare: {
    doc: "Generates a square wave oscillation",
    ex: "wsl.oscSquare(0.25, 1, 2) // => 2",
    fn: (t: P, frequency?: P, amplitude?: P, phase?: P) => {
      const time = num(t);
      const freq = num(frequency ?? 1);
      const amp = num(amplitude ?? 1);
      const ph = num(phase ?? 0);
      const period = 1 / freq;
      const t2 = (time + ph) % period;
      return t2 < period / 2 ? amp : -amp;
    },
  },
  oscSawtooth: {
    doc: "Generates a sawtooth wave oscillation",
    ex: "wsl.oscSawtooth(0.5, 1, 2) // => 0",
    fn: (t: P, frequency?: P, amplitude?: P, phase?: P) => {
      const time = num(t);
      const freq = num(frequency ?? 1);
      const amp = num(amplitude ?? 1);
      const ph = num(phase ?? 0);
      const period = 1 / freq;
      const t2 = (time + ph) % period;
      return ((t2 / period) * 2 - 1) * amp;
    },
  },
  decay: {
    doc: "Applies exponential decay to a value",
    ex: "wsl.decay(100, 0.1, 1) // => 90",
    fn: (current: P, rate: P, deltaTime: P) => {
      const c = num(current);
      const r = num(rate);
      const dt = num(deltaTime);
      return c * Math.pow(1 - r, dt);
    },
  },
  decayToward: {
    doc: "Applies exponential decay toward a target value",
    ex: "wsl.decayToward(100, 50, 0.1, 1) // => 95",
    fn: (current: P, target: P, rate: P, deltaTime: P) => {
      const c = num(current);
      const t = num(target);
      const r = num(rate);
      const dt = num(deltaTime);
      return t + (c - t) * Math.pow(1 - r, dt);
    },
  },
};
