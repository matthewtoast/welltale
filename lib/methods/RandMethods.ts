import { PRNG } from "../RandHelpers";
import { A, MethodDef, num, P, toArr } from "./MethodHelpers";

export const createRandomHelpers = (prng: PRNG): Record<string, MethodDef> => ({
  random: {
    doc: "Returns a float between 0.0 and 1.0 using the seeded PRNG",
    ex: "wsl.random() //=> 0.23489210239",
    fn: () => prng.next(),
  },
  randInt: {
    doc: "Returns a random integer between min and max (inclusive)",
    ex: "wsl.randInt(1, 10) //=> 7",
    fn: (min: P, max: P) => prng.getRandomInt(num(min), num(max)),
  },
  randFloat: {
    doc: "Returns a random float between min and max",
    ex: "wsl.randFloat(1.0, 10.0) //=> 7.234",
    fn: (min: P, max: P) => prng.getRandomFloat(num(min), num(max)),
  },
  randNormal: {
    doc: "Returns a random float using normal distribution between min and max",
    ex: "wsl.randNormal(1.0, 10.0) //=> 5.123",
    fn: (min: P, max: P) => prng.getRandomFloatNormal(num(min), num(max)),
  },
  randIntNormal: {
    doc: "Returns a random integer using normal distribution between min and max",
    ex: "wsl.randIntNormal(1, 10) //=> 6",
    fn: (min: P, max: P) => prng.getRandomIntNormal(num(min), num(max)),
  },
  coinToss: {
    doc: "Returns true/false based on probability (default 0.5)",
    ex: "wsl.coinToss(0.7) //=> true",
    fn: (prob?: P) => prng.coinToss(prob == null ? 0.5 : num(prob)),
  },
  dice: {
    doc: "Rolls a die with specified number of sides (default 6)",
    ex: "wsl.dice(20) //=> 15",
    fn: (sides?: P) => prng.dice(sides == null ? 6 : num(sides)),
  },
  rollDice: {
    doc: "Rolls multiple dice and returns array of results",
    ex: "wsl.rollDice(3, 6) //=> [4, 2, 6]",
    fn: (rolls: P, sides?: P) =>
      prng.rollMultipleDice(num(rolls), sides == null ? 6 : num(sides)),
  },
  randElement: {
    doc: "Returns a random element from the array",
    ex: "wsl.randElement([1, 2, 3]) //=> 2",
    fn: (arr: A) => {
      const t = toArr(arr);
      return t.length ? prng.randomElement(t) : null;
    },
  },
  shuffle: {
    doc: "Returns a shuffled copy of the array",
    ex: "wsl.shuffle([1, 2, 3]) //=> [3, 1, 2]",
    fn: (arr: A) => prng.shuffle(toArr(arr)),
  },
  randAlphaNum: {
    doc: "Returns a random alphanumeric string of specified length",
    ex: "wsl.randAlphaNum(8) //=> 'A7b9X2m1'",
    fn: (len: P) => prng.randAlphaNum(num(len)),
  },
  weightedRandom: {
    doc: "Returns index based on weighted probabilities",
    ex: "wsl.weightedRandom([0.1, 0.7, 0.2]) //=> 1",
    fn: (weights: P[]) => {
      const w = toArr(weights);
      if (!w.length) return null;
      const obj: Record<string, number> = {};
      w.forEach((v, i) => {
        obj[i.toString()] = num(v ?? 0);
      });
      return Number(prng.weightedRandomKey(obj));
    },
  },
  sample: {
    doc: "Returns n random elements from the array without replacement",
    ex: "wsl.sample([1, 2, 3, 4, 5], 3) //=> [2, 5, 1]",
    fn: (arr: A, n: P) => {
      const t = toArr(arr);
      const size = Math.min(num(n), t.length);
      const shuffled = prng.shuffle(t);
      return shuffled.slice(0, size);
    },
  },
});
