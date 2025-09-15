import { Parser } from "expr-eval";
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
