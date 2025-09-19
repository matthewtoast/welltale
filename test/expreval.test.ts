import { evalExpr } from "lib/EvalUtils";
import { dateHelpers, dateNow } from "lib/EvalMethods";
import { PRNG } from "lib/RandHelpers";
import { TSerial } from "typings";
import { expect } from "./TestUtils";

type Scope = Record<string, TSerial>;

type EvalTarget = {
  expr: string;
  expected: TSerial | boolean | number;
};

function evaluate(rng: PRNG, scope: Scope, target: EvalTarget) {
  const result = evalExpr(target.expr, scope, {}, rng);
  expect(result, target.expected);
}

function createScope(): Scope {
  const nested: TSerial = [[1], [2, [3]]];
  const combos: TSerial = [
    [1, 2],
    [3, 4],
    [3, 4],
  ];
  const scope: Scope = {
    values: [1, 2, 3, 2],
    words: ["foo", "bar"],
    nested,
    combos,
    extras: [4, 5],
    letters: ["a", "b", "a"],
    empty: [],
    bools: [true, false, true],
    others: [2, 4, 6],
    ok: true,
    ko: false,
    title: "  Foo Bar  ",
    phrase: "foo-bar_baz",
    long: "Hello world",
    tail: "sample.txt",
    none: null,
  };
  return scope;
}

function runArrayTests() {
  const rng = new PRNG("array-tests");
  const scope = createScope();
  const targets: EvalTarget[] = [
    { expr: 'includes(words, "foo")', expected: true },
    { expr: 'includes(values, 4)', expected: false },
    { expr: 'contains(values, 3)', expected: true },
    { expr: 'len(values)', expected: 4 },
    { expr: 'first(values)', expected: 1 },
    { expr: 'last(words)', expected: "bar" },
    { expr: 'nth(values, 2)', expected: 3 },
    { expr: 'slice(values, 1, 3)', expected: [2, 3] },
    { expr: 'take(values, 2)', expected: [1, 2] },
    { expr: 'drop(values, 2)', expected: [3, 2] },
    { expr: 'concat(values, extras)', expected: [1, 2, 3, 2, 4, 5] },
    { expr: 'reverse(values)', expected: [2, 3, 2, 1] },
    { expr: 'sort(values)', expected: [1, 2, 2, 3] },
    { expr: 'sortDesc(values)', expected: [3, 2, 2, 1] },
    { expr: 'uniq(letters)', expected: ["a", "b"] },
    { expr: 'flatten(nested)', expected: [1, 2, [3]] },
    { expr: 'flattenDeep(nested)', expected: [1, 2, 3] },
    { expr: 'flattenDeep(nested, 1)', expected: [1, 2, [3]] },
    { expr: 'indexOf(values, 3)', expected: 2 },
    { expr: 'count(values, 2)', expected: 2 },
    { expr: 'compact(bools)', expected: [true, true] },
    { expr: 'sum(values)', expected: 8 },
    { expr: 'mean(values)', expected: 2 },
    { expr: 'median(values)', expected: 2 },
    { expr: 'sumBy(combos, 1)', expected: 10 },
    { expr: 'mapAdd(values, 1)', expected: [2, 3, 4, 3] },
    { expr: 'mapSub(values, 1)', expected: [0, 1, 2, 1] },
    { expr: 'mapMul(values, 2)', expected: [2, 4, 6, 4] },
    { expr: 'mapDiv(values, 2)', expected: [0.5, 1, 1.5, 1] },
    { expr: 'union(values, extras)', expected: [1, 2, 3, 4, 5] },
    { expr: 'intersection(values, others)', expected: [2] },
    { expr: 'difference(values, others)', expected: [1, 3] },
  ];
  for (const target of targets) evaluate(rng, scope, target);
}

runArrayTests();

function runTernaryTests() {
  const rng = new PRNG("ternary-tests");
  const scope = createScope();
  const targets: EvalTarget[] = [
    { expr: 'ok ? "yes" : "no"', expected: "yes" },
    { expr: 'ko ? "yes" : "no"', expected: "no" },
    {
      expr: 'len(values) > len(extras) ? first(values) : last(extras)',
      expected: 1,
    },
    {
      expr: 'contains(words, "baz") ? first(words) : "missing"',
      expected: "missing",
    },
    { expr: 'ok ? nth(values, 1) : nth(values, 2)', expected: 2 },
    {
      expr: 'sum(values) > sum(extras) ? "values" : "extras"',
      expected: "extras",
    },
  ];
  for (const target of targets) evaluate(rng, scope, target);
}

runTernaryTests();

function runStringTests() {
  const rng = new PRNG("string-tests");
  const scope = createScope();
  const targets: EvalTarget[] = [
    { expr: 'lower("HELLO")', expected: "hello" },
    { expr: 'upper("hello")', expected: "HELLO" },
    { expr: 'capitalize("foo bar")', expected: "Foo bar" },
    { expr: 'trim(title)', expected: "Foo Bar" },
    { expr: 'replace(phrase, "-", " ")', expected: "foo bar_baz" },
    { expr: 'includes(long, "wor")', expected: true },
    { expr: 'startsWith(long, "He")', expected: true },
    { expr: 'endsWith(tail, ".txt")', expected: true },
    { expr: 'substring(long, 0, 5)', expected: "Hello" },
    { expr: 'slice(long, 6)', expected: "world" },
    { expr: 'indexOf(long, "o")', expected: 4 },
    { expr: 'lastIndexOf(long, "o")', expected: 7 },
    { expr: 'split(phrase, "-")', expected: ["foo", "bar_baz"] },
    { expr: 'join("foo", "bar", "-")', expected: "foo-bar" },
    { expr: 'concat("foo", "bar")', expected: "foobar" },
  ];
  for (const target of targets) evaluate(rng, scope, target);
}

runStringTests();

function runMathTests() {
  const rng = new PRNG("math-tests");
  const scope = createScope();
  const targets: EvalTarget[] = [
    { expr: "abs(-7)", expected: 7 },
    { expr: "max(1, 9, 5)", expected: 9 },
    { expr: "min(1, 9, 5)", expected: 1 },
    { expr: "clamp(10, 0, 5)", expected: 5 },
    { expr: "clamp(-3, 0, 5)", expected: 0 },
    { expr: "avg(2, 4, 6, 8)", expected: 5 },
    { expr: "pow(2, 3)", expected: 8 },
    { expr: "sqrt(81)", expected: 9 },
    { expr: "round(mean(values))", expected: 2 },
    { expr: "floor(2.9)", expected: 2 },
    { expr: "ceil(2.1)", expected: 3 },
    { expr: "trunc(-2.8)", expected: -2 },
    { expr: "sign(sum(values) - sum(extras))", expected: -1 },
    { expr: "factorial(5)", expected: 120 },
    { expr: "gcd(54, 24)", expected: 6 },
    { expr: "lcm(6, 8)", expected: 24 },
    { expr: "nCr(5, 2)", expected: 10 },
    {
      expr: "round(mean(mapMul(values, 1.5)))",
      expected: 3,
    },
  ];
  for (const target of targets) evaluate(rng, scope, target);
}

runMathTests();

function runRandomTests() {
  const rng = new PRNG("random-tests");
  const scope = createScope();
  const targets: EvalTarget[] = [
    { expr: "random()", expected: 0.7022553334868497 },
    { expr: "randInt(1, 10)", expected: 3 },
    { expr: "randFloat(0, 1)", expected: 0.9934626525769458 },
    { expr: "randNormal(0, 10)", expected: 5.086766669645441 },
    { expr: "randIntNormal(0, 10)", expected: 5 },
    { expr: "coinToss(0.7)", expected: false },
    { expr: "dice(6)", expected: 3 },
    { expr: "rollDice(3, 6)", expected: [6, 5, 2] },
    { expr: "randElement(words)", expected: "foo" },
    { expr: "shuffle(values)", expected: [3, 1, 2, 2] },
    { expr: "randAlphaNum(5)", expected: "dHpdB" },
    { expr: "weightedRandom([1, 3, 6])", expected: 1 },
    { expr: "sample(values, 3)", expected: [2, 3, 2] },
  ];
  for (const target of targets) evaluate(rng, scope, target);
}

runRandomTests();

function runDateTests() {
  const rng = new PRNG("date-tests");
  const scope = createScope();
  const originalNow = dateNow.current;
  dateNow.current = () => new Date(2025, 2, 14, 12, 34, 56, 0);
  const current = dateNow.current();

  const targets: EvalTarget[] = [
    { expr: "timestamp(2024, 2, 29, 15, 30, 0)", expected: 1709220600000 },
    {
      expr: 'formatDate(timestamp(2024, 2, 29, 15, 30, 0), "YYYY/MM/DD HH:mm:ss")',
      expected: "2024/02/29 15:30:00",
    },
    { expr: "year(timestamp(2024, 2, 29))", expected: 2024 },
    { expr: "month(timestamp(2024, 2, 29))", expected: 2 },
    { expr: "day(timestamp(2024, 2, 29))", expected: 29 },
    {
      expr: "isLeapYear(2024)",
      expected: true,
    },
    {
      expr: "daysInMonth(2024, 2)",
      expected: 29,
    },
    {
      expr: "isSameWeek(timestamp(2024, 1, 1), addDays(timestamp(2024, 1, 1), 6))",
      expected: false,
    },
    {
      expr: "isSameMonth(timestamp(2024, 1, 15), timestamp(2024, 1, 31))",
      expected: true,
    },
    {
      expr: "isBetween(timestamp(2024, 1, 15), timestamp(2024, 1, 10), timestamp(2024, 1, 20))",
      expected: true,
    },
    {
      expr: "addDays(timestamp(2024, 1, 30), 5)",
      expected: dateHelpers.timestamp(
        2024,
        2,
        4,
        current.getUTCHours(),
        current.getUTCMinutes(),
        current.getUTCSeconds()
      ),
    },
    {
      expr: 'formatDate(addDays(timestamp(2024, 1, 30), 5), "YYYY-MM-DD")',
      expected: "2024-02-04",
    },
    {
      expr: "timeSince(timestamp(2024, 1, 1), timestamp(2024, 1, 2))",
      expected: "1 day ago",
    },
    {
      expr: "timeUntil(timestamp(2024, 1, 3), timestamp(2024, 1, 1))",
      expected: "in 2 days",
    },
    {
      expr: "decimalHoursToClock(msToDecimalHours(5400000))",
      expected: "1:30",
    },
    {
      expr: "weekOfYear(timestamp(2024, 1, 10))",
      expected: 2,
    },
    {
      expr: "dayOfYear(timestamp(2024, 3, 1))",
      expected: 61,
    },
  ];

  try {
    for (const target of targets) evaluate(rng, scope, target);

    const partialValue = dateHelpers.timestamp(2024, null, null, null, null, null) as number;
    const partial = new Date(partialValue);
    expect(partial.getFullYear(), 2024);
    expect(partial.getMonth(), current.getMonth());
    expect(partial.getDate(), current.getDate());
    expect(partial.getHours(), current.getHours());
    expect(partial.getMinutes(), current.getMinutes());
    expect(partial.getSeconds(), current.getSeconds());

    const undefinedValue = dateHelpers.timestamp(1985) as number;
    const undefinedDate = new Date(undefinedValue);
    expect(undefinedDate.getFullYear(), 1985);
    expect(undefinedDate.getMonth(), current.getMonth());
    expect(undefinedDate.getDate(), current.getDate());
    expect(undefinedDate.getHours(), current.getHours());
    expect(undefinedDate.getMinutes(), current.getMinutes());
    expect(undefinedDate.getSeconds(), current.getSeconds());

    const allCurrentValue = dateHelpers.timestamp(null, null, null, null, null, null) as number;
    const allCurrent = new Date(allCurrentValue);
    expect(allCurrent.getFullYear(), current.getFullYear());
    expect(allCurrent.getMonth(), current.getMonth());
    expect(allCurrent.getDate(), current.getDate());
    expect(allCurrent.getHours(), current.getHours());
    expect(allCurrent.getMinutes(), current.getMinutes());
    expect(allCurrent.getSeconds(), current.getSeconds());

    const exprPartial = evalExpr(
      "timestamp(1999, none, none, none, none, none)",
      scope,
      {},
      rng
    ) as number;
    const exprPartialDate = new Date(exprPartial);
    expect(exprPartialDate.getFullYear(), 1999);
    expect(exprPartialDate.getMonth(), current.getMonth());
    expect(exprPartialDate.getDate(), current.getDate());

    const exprUndefined = evalExpr("timestamp(2001)", scope, {}, rng) as number;
    const exprUndefinedDate = new Date(exprUndefined);
    expect(exprUndefinedDate.getFullYear(), 2001);
    expect(exprUndefinedDate.getMonth(), current.getMonth());
    expect(exprUndefinedDate.getDate(), current.getDate());
  } finally {
    dateNow.current = originalNow;
  }
}

runDateTests();
