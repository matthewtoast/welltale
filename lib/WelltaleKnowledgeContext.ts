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

export async function renderContext() {
  const welltaleReadme = readFileSync(join(ROOT_DIR, "README.md")).toString();

  const welltaleExampleCartridge = await loadDirRecursive(
    join(ROOT_DIR, "fic/example")
  );

  const welltaleTagReferenceDocs = ACTION_HANDLERS.map(
    ({ tags, docs, syntax }) => {
      return {
        tags,
        docs,
        syntax,
      };
    }
  ).filter(({ docs, syntax }) => !!docs);

  const welltaleTemplatePatternSyntaxDocs = TEMPLATE_SYNTAX;

  const welltaleLanguageConfiguration = readFileSync(
    join(ROOT_DIR, ".vscode/extensions/welltale/language-configuration.json")
  ).toString();

  const welltaleSyntaxTmLanugage = readFileSync(
    join(
      ROOT_DIR,
      ".vscode/extensions/welltale/syntaxes/welltale.tmLanguage.json"
    )
  ).toString();

  const welltaleContext = `
Welltale's README, with an overview and explanation:
~~~~~
${welltaleReadme}
~~~~~

Documentation on all supported special XML tags in Welltale:
~~~~~
${welltaleTagReferenceDocs
  .map(({ docs, syntax, tags }) => {
    return `
Tag: <${tags[0]}>
Desc: ${(docs?.desc ?? "").replace(/\n+/g, "\n")}
Attrs: ${JSON.stringify(syntax?.atts)}
`.trim();
  })
  .join("\n\n")}
~~~~~

Documentation on template pattern syntax in Welltale:
~~~~~
${welltaleTemplatePatternSyntaxDocs
  .map(({ syntax, desc, examples }) => {
    return `
Syntax: ${syntax}
Desc: ${(desc ?? "").replace(/\n+/g, "\n")}
`.trim();
  })
  .join("\n\n")}
~~~~~

A longer Welltale story example, showcasing usage of multiple tags:
~~~~~
${Object.keys(welltaleExampleCartridge)
  .map((key) => {
    const filename = last(key.split("/"));
    const content = welltaleExampleCartridge[key].toString();
    return `
=== ${filename} ===
\`\`\`${last(filename?.split("."))}
${content}
\`\`\`
`.trim();
  })
  .join("\n\n")}
~~~~~
`.trim();

  return welltaleContext;
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
