import { createHighlighter, hastToHtml } from "shiki";
import type { LanguageRegistration } from "@shikijs/types";
import welltaleGrammar from "../.vscode/extensions/welltale/syntaxes/welltale.tmLanguage.json";

type HighlightTheme = "github-light" | "github-dark";

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;
let languageLoaded = false;

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function toLanguageRegistration(): LanguageRegistration {
  return {
    ...(welltaleGrammar as unknown as LanguageRegistration),
    aliases: ["welltale", "wsl"],
  };
}

async function loadHighlighter() {
  if (highlighter) return highlighter;
  highlighter = await createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: ["xml", "javascript", "typescript"],
  });
  return highlighter;
}

async function ensureLanguage(): Promise<boolean> {
  if (languageLoaded) return true;
  const instance = await loadHighlighter();
  await instance.loadLanguage(toLanguageRegistration());
  languageLoaded = true;
  return true;
}

export async function highlightCode(code: string, language: string, theme: HighlightTheme): Promise<string | null> {
  const loaded = await ensureLanguage().catch((error) => {
    console.warn("Failed to load Welltale grammar", error);
    return false;
  });
  const instance = highlighter;
  if (!loaded || !instance) return null;
  return Promise.resolve()
    .then(async () => {
      const tree = await instance.codeToHast(code, { lang: language, theme });
      highlightTemplateVariables(tree);
      return hastToHtml(tree);
    })
    .catch((error) => {
      console.warn("Failed to highlight code", error);
      return null;
    });
}

function highlightTemplateVariables(node: HastNode) {
  if (!node || !node.children || node.children.length === 0) return;

  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && typeof child.value === "string") {
      const segments = splitTemplateSegments(child.value);
      if (segments.length === 1) return [child];
      return segments.map((segment) => {
        if (segment.isTemplate) {
          return createTemplateSpan(segment.value);
        }
        if (!segment.value) return null;
        return { type: "text", value: segment.value } as HastNode;
      }).filter(Boolean) as HastNode[];
    }

    highlightTemplateVariables(child);
    return [child];
  });
}

function splitTemplateSegments(value: string) {
  const matches: { value: string; isTemplate: boolean }[] = [];
  const regex = /\{\{[\s\S]*?\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      matches.push({ value: value.slice(lastIndex, match.index), isTemplate: false });
    }
    matches.push({ value: match[0], isTemplate: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    matches.push({ value: value.slice(lastIndex), isTemplate: false });
  }

  if (!matches.length) {
    matches.push({ value, isTemplate: false });
  }

  return matches;
}

function createTemplateSpan(value: string): HastNode {
  return {
    type: "element",
    tagName: "span",
    properties: {
      style: "color:#ffab70;font-weight:500",
    },
    children: [{ type: "text", value }],
  };
}
