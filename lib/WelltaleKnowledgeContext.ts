import dedent from "dedent";
import { last } from "lodash";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACTION_HANDLERS } from "./engine/StoryActions";
import { TEMPLATE_SYNTAX } from "./engine/StoryDocs";
import { loadDirRecursive } from "./FileUtils";
import { buildMethodDocGroups } from "./methods/MethodDocs";

const ROOT_DIR = join(__dirname, "..");

export type RenderContextOptions = {
  readme: boolean;
  tagDocs: boolean;
  methodDocs: boolean;
  templateSyntax: boolean;
  example: boolean;
  languageConfig: boolean;
  syntaxTmLanguage: boolean;
};

export const DEFAULT_RENDER_CTX_OPTIONS: RenderContextOptions = {
  readme: true,
  tagDocs: true,
  methodDocs: true,
  templateSyntax: true,
  example: true,
  languageConfig: false,
  syntaxTmLanguage: false,
};

const SQUIGGLE_DELIM = "\n~~~~~\n";

export async function renderContext(
  opts: RenderContextOptions = DEFAULT_RENDER_CTX_OPTIONS
) {
  const parts: string[] = [];

  if (opts.readme) {
    const readme = readFileSync(join(ROOT_DIR, "README.md")).toString();
    parts.push(
      `Welltale's README, with an overview and explanation:${SQUIGGLE_DELIM}${readme}`
    );
  }

  if (opts.tagDocs) {
    const tagDocs = ACTION_HANDLERS.map(({ tags, docs, syntax }) => ({
      tags,
      docs,
      syntax,
    })).filter(
      ({ docs, syntax, tags }) => !!docs && !tags.includes("llm:create")
    );

    parts.push(
      `Supported XML tags:${SQUIGGLE_DELIM}` +
        tagDocs
          .map(({ docs, syntax, tags }) => {
            return dedent`
      Tag: <${tags[0]}>${
        tags.length > 1
          ? ` (${tags
              .slice(1)
              .map((t) => `<${t}>`)
              .join(", ")})`
          : ""
      }
      Desc: ${(docs?.desc ?? "").replace(/\n+/g, "\n")}
      Attrs: ${JSON.stringify(syntax?.atts)}
      `.trim();
          })
          .join("\n\n")
    );
  }

  if (opts.methodDocs) {
    const mdgs = buildMethodDocGroups();
    parts.push(
      `JavaScript environment built-in utility functions:${SQUIGGLE_DELIM}` +
        mdgs
          .flatMap((g) =>
            g.items.map((i) => {
              return `${i.example} ${i.description}`;
            })
          )
          .join("\n")
    );
  }

  if (opts.templateSyntax) {
    parts.push(
      `Template pattern syntax:${SQUIGGLE_DELIM}` +
        TEMPLATE_SYNTAX.map(({ syntax, desc }) => {
          return `
Syntax: ${syntax}
Desc: ${(desc ?? "").replace(/\n+/g, "\n")}
`.trim();
        }).join("\n\n")
    );
  }

  if (opts.example) {
    const exampleCartridge = await loadDirRecursive(
      join(ROOT_DIR, "fic/example")
    );
    parts.push(
      `Story example using moss features:${SQUIGGLE_DELIM}` +
        Object.keys(exampleCartridge)
          .map((key) => {
            const filename = last(key.split("/"));
            const content = exampleCartridge[key].toString();
            return `
=== ${filename} ===
\`\`\`${last(filename?.split("."))}
${content}
\`\`\`
`.trim();
          })
          .join("\n\n")
    );
  }

  if (opts.languageConfig) {
    const langConfig = readFileSync(
      join(ROOT_DIR, ".vscode/extensions/welltale/language-configuration.json")
    ).toString();
    parts.push(`Lnguage configuration:${SQUIGGLE_DELIM}${langConfig}`);
  }

  if (opts.syntaxTmLanguage) {
    const tmLang = readFileSync(
      join(
        ROOT_DIR,
        ".vscode/extensions/welltale/syntaxes/welltale.tmLanguage.json"
      )
    ).toString();
    parts.push(`Syntax definition:${SQUIGGLE_DELIM}${tmLang}`);
  }

  return parts.join(SQUIGGLE_DELIM).trim();
}
