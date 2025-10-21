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

export type RenderContextOptions = {
  readme: boolean;
  tagDocs: boolean;
  templateSyntax: boolean;
  example: boolean;
  languageConfig: boolean;
  syntaxTmLanguage: boolean;
};

export const DEFAULT_RENDER_CTX_OPTIONS: RenderContextOptions = {
  readme: true,
  tagDocs: true,
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
  title: string,
  author: string,
  concept: string,
  provider: StoryServiceProvider,
  textCompletionOptions: GenerateTextCompletionOptions,
  renderContextOptions: RenderContextOptions = DEFAULT_RENDER_CTX_OPTIONS
) {
  const data = await provider.generateJson(
    dedent`
    Given the following story title and idea, generate story metadata for an interactive audio story.
    <TITLE>${title}</TITLE>
    <CONCEPT>${concept}</CONCEPT>
    The data in this object is used both as metadata for searching stories, and as initial values for the story.
    It must contain title, tags, description. The other fields are optional and only used if necessary.
    The rest of the object is open-ended and can be used to pre-define values for state variables that may be used in the story.
    If you define any voices but separately define character data make sure to use the same id string.
    Unless specified, the fields you add should primarily be usable as either (a) *values* for story scripting or (b) text strings that can be used in LLM prompts or fragments thereof.
  `,
    {
      concept,
      tags: [
        'Array of 5 or more string tags for the story, e.g. "fantasy", "suspense"...',
      ],
      description:
        "Short promo blurb describing what the story is about; short enough to display within a small smartphone app medallion",
      pronunciations: {
        "[key]":
          "Key-value pairs mapping unfamiliar words to pronunciations. like Trost: Troast",
      },
      player: {
        "[key]":
          "Key-value pairs with data for the player (empty object if none needed)",
      },
      voices: {
        "[voice-id]":
          "Detailed description of the voice of this character; include gender, age, accent, speaking style, etc",
      },
      "[key]":
        "Any other readable values we want to define for the story. can be any JSON-serializable type",
    },
    textCompletionOptions
  );

  Object.assign(data, { author, generatedAt: Date.now() });

  const result = await provider.generateChat(
    [
      {
        role: "system",
        body: dedent`
          You are an interactive audio story author. You craft immersive, audio-first narratives with dynamic, interactive elements.

          You write stories using **Welltale Story Language (WSL)** — your preferred framework for interactive audio storytelling.

          Your understanding of WSL, and its ability to create open-ended stories and branching narratives with infinite replayability, is complete and authoritative:

          >>>>> WELLTALE KNOWLEDGE BEGIN >>>>>
          ${await renderContext(renderContextOptions)}
          <<<<< WELLTALE KNOWLEDGE END <<<<<

          The user will give you some creative instruction data including a title, data fields, and most importantly a concept.

          Your task is to write a story in **WSL**, fully aligned with the user’s intent (their concept) using the data fields.

          Output only valid WSL content — no explanations, no commentary, no markdown.

          If your content is incomplete, add a comment like \`<!-- continued -->\` on the last line.

          **Guidelines:**
          - Use elegant, minimal WSL syntax with no unnecessary ceremony. Do not reference this engine, Welltale, etc. in the story itself.
          - Write for audio listeners: prioritize pacing, rhythm, and clarity (but don't reference this unless asked).
          - Encourage interactivity and player agency. Leverage the DSL's generative features and template patterns to generate unique content per playthrough.
          - Prefer to create dynamic (as opposed to hard-coded) content.Use <while>, <block>/<yield>, variables and more to 10X your storytelling capabilities.
          - Don't be too "on the nose" with content. Focus on creating elegant story structures with high dynamism more than written content per se.
          - Be mindful of ideal story format: is it first person? is a narrator needed? is it explicit story choices or just open dialog?
          - Think of your task as to create a "unique situation generator" - open-ended, branching, and endless narrative.
          - Consider abstractions like scenes, locations, characters (and moods), items to avoid hardcoding. Part story, part simulated world.
        `,
      },
      {
        role: "user",
        body: dedent`
          Create WSL content based on this info:
          ---
          ${JSON.stringify(data, null, 2)}
          ---
          Return only the WSL content:
        `,
      },
    ],
    textCompletionOptions
  );

  return {
    data,
    main: result.body,
  };
}
