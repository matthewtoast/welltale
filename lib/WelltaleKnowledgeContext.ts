import dedent from "dedent";
import { last } from "lodash";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadDirRecursive } from "./FileUtils";
import { ACTION_HANDLERS } from "./StoryActions";
import { TEMPLATE_SYNTAX } from "./StoryDocs";
import {
  GenerateTextCompletionOptions,
  StoryServiceProvider,
} from "./StoryServiceProvider";

const ROOT_DIR = join(__dirname, "..");

type RenderContextOptions = {
  readme: boolean;
  tagDocs: boolean;
  templateSyntax: boolean;
  example: boolean;
  languageConfig: boolean;
  syntaxTmLanguage: boolean;
};

const SQUIGGLE_DELIM = "\n~~~~~\n";

export async function renderContext(
  opts: RenderContextOptions = {
    readme: true,
    tagDocs: true,
    templateSyntax: true,
    example: true,
    languageConfig: false,
    syntaxTmLanguage: false,
  }
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
    })).filter(({ docs, syntax }) => !!docs);

    parts.push(
      `Documentation on all supported special XML tags in Welltale:${SQUIGGLE_DELIM}` +
        tagDocs
          .map(({ docs, syntax, tags }) => {
            return `
Tag: <${tags[0]}>
Desc: ${(docs?.desc ?? "").replace(/\n+/g, "\n")}
Attrs: ${JSON.stringify(syntax?.atts)}
`.trim();
          })
          .join("\n\n")
    );
  }

  if (opts.templateSyntax) {
    parts.push(
      `Documentation on template pattern syntax in Welltale:${SQUIGGLE_DELIM}` +
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
      `A longer Welltale story example, showcasing usage of multiple tags:${SQUIGGLE_DELIM}` +
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
    parts.push(
      `Welltale language configuration:${SQUIGGLE_DELIM}${langConfig}`
    );
  }

  if (opts.syntaxTmLanguage) {
    const tmLang = readFileSync(
      join(
        ROOT_DIR,
        ".vscode/extensions/welltale/syntaxes/welltale.tmLanguage.json"
      )
    ).toString();
    parts.push(`Welltale tmLanguage syntax:${SQUIGGLE_DELIM}${tmLang}`);
  }

  return parts.join(SQUIGGLE_DELIM).trim();
}

export async function createWelltaleContent(
  prompt: string,
  provider: StoryServiceProvider,
  options: GenerateTextCompletionOptions
) {
  const result = await provider.generateChat(
    [
      {
        role: "system",
        body: dedent`
          You are an interactive audio story author. You're an expert at crafting entertaining, audio-first stories with interactive and dynamic elements.
          You've written successful audio games, audiobooks, short audio stories, audio articles, podcasts, and more, all using interactive audio as a medium.
          You always use Welltale Story Language (WSL) to write stories because it is your favorite framework. Your knowledge of Welltale is exhaustive.
          >>>>> WELLTALE KNOWLEDGE BEGIN >>>>>
          ${await renderContext()}
          <<<<< WELLTALE KNOWLEDGE END <<<<<
          The user will give you an instruction, and you will write them a complete story in WSL following their guidelines.
          Remember, you write audio stories, thus output content will only be heard, not seen, so please write accordingly!
          You always write elegant WSL syntax using only the minimal ceremony necessary to tell the story per the user's specification.
        `,
      },
      {
        role: "user",
        body: dedent`
          Create the Welltale content for an interactive audio story, based on my instruction:
          ---
          ${prompt}
          ---
          Return only the WSL content of the story:
        `,
      },
    ],
    options
  );
  return result.body;
}
