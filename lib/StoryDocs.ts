import { ActionHandler } from "./StoryTypes";

const uniq = (xs: string[]) => [...new Set(xs)];
const flat = <T>(x: T[][]) => x.reduce((a, b) => a.concat(b), [] as T[]);
const mdEscape = (s: string) => s.replace(/\|/g, "\\|");
const first = (s?: string) => s?.split("\n")[0] ?? "";

export const buildSnippet = (tag: string, s?: ActionHandler["syntax"]) => {
  const atts = Object.entries(s?.atts ?? {}).filter(([, a]) => a.req);
  const attrs = atts
    .map(([k, a], i) => `${k}="\${${i + 1}:${a.default ?? k}}"`)
    .join(" ");
  return s?.block
    ? `<${tag}${attrs ? " " + attrs : ""}>\n  $0\n</${tag}>`
    : `<${tag}${attrs ? " " + attrs : ""} />`;
};

export const mdForHandler = (h: ActionHandler) => {
  const tag = h.tags[0] ?? "";
  const desc = h.docs?.desc ?? "";
  const rows = Object.entries(h.syntax?.atts ?? {})
    .map(
      ([k, a]) =>
        `| ${k} | ${a.type} | ${a.req ? "yes" : "no"} | ${a.default ?? ""} | ${mdEscape(a.desc)} |`
    )
    .join("\n");
  const atts = rows
    ? `## Attributes\n| name | type | required | default | desc |\n|---|---|---|---|---|\n${rows}\n`
    : "";
  const ex = (h.docs?.ex ?? [])
    .map((e) => `\n\`\`\`xml\n${e.code}\n\`\`\``)
    .join("\n");
  const cats = h.docs?.cats?.length
    ? `\n**Categories:** ${h.docs?.cats.join(", ")}`
    : "";
  return [`# ${tag}`, desc, atts, ex, cats].filter(Boolean).join("\n\n");
};

export const mdAll = (hs: ActionHandler[]) => {
  const m = new Map<string, string>();
  hs.forEach((h) => {
    if (h.tags.length) m.set(h.tags[0], mdForHandler(h));
  });
  return Object.fromEntries(m);
};

export const textMateGrammar = (hs: ActionHandler[]) => {
  const kws = uniq(flat(hs.map((h) => h.tags)))
    .sort()
    .join("|");
  return {
    $schema:
      "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
    name: "DSL",
    scopeName: "source.dsl",
    patterns: [
      { name: "comment.line.number-sign.dsl", match: "#.*$" },
      { name: "string.quoted.double.dsl", begin: '"', end: '"' },
      { name: "constant.numeric.dsl", match: "\\b\\d+(?:\\.\\d+)?\\b" },
      { name: "entity.name.tag.dsl", match: `</?(?:${kws})\\b` },
    ],
  };
};

export const vscodeCompletions = (hs: ActionHandler[]) => {
  const items = flat(
    hs.map((h) =>
      h.tags.map((t) => {
        const s = buildSnippet(t, h.syntax);
        const atts = h.syntax?.atts ?? {};
        const attLines = Object.entries(atts)
          .map(
            ([k, a]) =>
              `- \`${k}\`: ${a.type}${a.req ? " (required)" : ""}${a.default ? ` = ${a.default}` : ""}${a.desc ? ` — ${a.desc}` : ""}`
          )
          .join("\n");
        const doc = [
          `**${t}**`,
          first(h.docs?.desc),
          attLines ? "\n**Attributes**\n" + attLines : "",
        ]
          .filter(Boolean)
          .join("\n");
        return {
          label: t,
          kind: 14,
          insertTextRules: 4,
          insertText: s,
          detail: first(h.docs?.desc),
          documentation: doc,
        };
      })
    )
  );
  return items;
};

export const vscodeHovers = (hs: ActionHandler[]) => {
  const pairs = flat(
    hs.map((h) =>
      h.tags.map((t) => {
        const atts = h.syntax?.atts ?? {};
        const attLines = Object.entries(atts)
          .map(
            ([k, a]) =>
              `- \`${k}\`: ${a.type}${a.req ? " (required)" : ""}${a.default ? ` = ${a.default}` : ""}${a.desc ? ` — ${a.desc}` : ""}`
          )
          .join("\n");
        const md = [
          `**${t}**`,
          first(h.docs?.desc),
          attLines ? "\n**Attributes**\n" + attLines : "",
        ]
          .filter(Boolean)
          .join("\n");
        return [t, md] as const;
      })
    )
  );
  return Object.fromEntries(pairs);
};

export const keywords = (hs: ActionHandler[]) =>
  uniq(flat(hs.map((h) => h.tags))).sort();
