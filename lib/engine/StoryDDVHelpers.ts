import { DDVState } from "./StoryTypes";

const splitOpts = (s: string) =>
  s.split(/(?<!\\)\|/g).map((x) => x.trim().replace(/\\([|\[\]])/g, "$1"));
const shuffle = (n: number, next: () => number) => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function resolveBracketDDV(
  s: string,
  ctx: {
    rng: { next: () => number; randomElement: <T>(a: T[]) => T };
    session: { ddv: DDVState };
  }
): string {
  return s.replace(/\[\[([\s\S]+?)\]\]/g, (_m, raw: string) => {
    let inner = raw.trim();
    let mode: "^" | "~" | "" = "";
    if (inner[0] === "^" || inner[0] === "~") {
      mode = inner[0] as any;
      inner = inner.slice(1).trim();
    }
    const key = inner;
    const opts = splitOpts(inner);
    if (opts.length < 2) return opts[0] ?? "";
    if (mode === "^") {
      const i = ctx.session.ddv!.cycles[key] ?? 0;
      ctx.session.ddv!.cycles[key] = (i + 1) % opts.length;
      return opts[i % opts.length];
    }
    if (mode === "~") {
      let bag = ctx.session.ddv!.bags[key];
      if (!bag || bag.order.length !== opts.length) {
        bag = { order: shuffle(opts.length, ctx.rng.next), idx: 0 };
        ctx.session.ddv!.bags[key] = bag;
      }
      const pick = opts[bag.order[bag.idx]];
      bag.idx = (bag.idx + 1) % bag.order.length;
      if (bag.idx === 0) bag.order = shuffle(opts.length, ctx.rng.next);
      return pick;
    }
    return ctx.rng.randomElement(opts);
  });
}
