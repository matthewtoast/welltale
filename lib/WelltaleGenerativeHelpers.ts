import {
  GenerateTextCompletionOptions,
  StoryServiceProvider,
} from "./engine/StoryServiceProvider";
import {
  DEFAULT_RENDER_CTX_OPTIONS,
  RenderContextOptions,
} from "./WelltaleKnowledgeContext";

export async function createWelltaleContent(
  title: string,
  author: string,
  concept: string,
  provider: StoryServiceProvider,
  textCompletionOptions: GenerateTextCompletionOptions,
  renderContextOptions: RenderContextOptions = DEFAULT_RENDER_CTX_OPTIONS
): Promise<string> {
  // const result = await provider.generateChat(
  //   [
  //     {
  //       role: "system",
  //       body: dedent`
  //         You are an interactive audio story author. You craft immersive, audio-first narratives with dynamic, interactive elements.
  //         You write stories using **Welltale Story Language (WSL)** — your preferred framework for interactive audio storytelling.
  //         Your understanding of WSL, and its ability to create open-ended stories and branching narratives with infinite replayability, is complete and authoritative:
  //         >>>>> WELLTALE KNOWLEDGE BEGIN >>>>>
  //         ${await renderContext(renderContextOptions)}
  //         <<<<< WELLTALE KNOWLEDGE END <<<<<
  //         The user will give you some creative instruction data including a title, data fields, and most importantly a concept.
  //         Your task is to write a story in **WSL**, fully aligned with the user’s intent (their concept) using the data fields.
  //         Output only valid WSL content — no explanations, no commentary, no markdown.
  //         If your content is incomplete, add a comment like \`<!-- continued -->\` on the last line.
  //         **Guidelines:**
  //         - Use elegant, minimal WSL syntax with no unnecessary ceremony. Do not reference this engine, Welltale, etc. in the story itself.
  //         - Write for audio listeners: prioritize pacing, rhythm, and clarity (but don't reference this unless asked).
  //         - Encourage interactivity and player agency. Leverage the DSL's generative features and template patterns to generate unique content per playthrough.
  //         - Prefer to create dynamic (as opposed to hard-coded) content.Use <while>, <block>/<yield>, variables and more to 10X your storytelling capabilities.
  //         - Don't be too "on the nose" with content. Focus on creating elegant story structures with high dynamism more than written content per se.
  //         - Be mindful of ideal story format: is it first person? is a narrator needed? is it explicit story choices or just open dialog?
  //         - Think of your task as to create a "unique situation generator" - open-ended, branching, and endless narrative.
  //         - Consider abstractions like scenes, locations, characters (and moods), items to avoid hardcoding. Part story, part simulated world.
  //       `,
  //     },
  //     {
  //       role: "user",
  //       body: dedent`
  //         Create WSL content based on this info:
  //         ---
  //         ${JSON.stringify(data, null, 2)}
  //         ---
  //         Return only the WSL content:
  //       `,
  //     },
  //   ],
  //   textCompletionOptions
  // );
  // return {
  //   data,
  //   main: result.body,
  // };

  return "";
}
