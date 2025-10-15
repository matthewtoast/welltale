import { createHighlighter, hastToHtml } from "shiki";
import type { LanguageRegistration } from "@shikijs/types";
import type { Highlighter } from "shiki";
import welltaleGrammar from "../.vscode/extensions/welltale/syntaxes/welltale.tmLanguage.json";

type HighlightTheme = "github-light" | "github-dark";

type ShikiSharedState = {
  highlighter: Highlighter | null;
  promise: Promise<Highlighter> | null;
  languageLoaded: boolean;
};

const globalStore = globalThis as typeof globalThis & {
  __welltaleShiki?: ShikiSharedState;
};

const shikiState: ShikiSharedState =
  globalStore.__welltaleShiki ??
  (globalStore.__welltaleShiki = {
    highlighter: null,
    promise: null,
    languageLoaded: false,
  });

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
  if (shikiState.highlighter) return shikiState.highlighter;
  if (!shikiState.promise) {
    shikiState.promise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["xml", "javascript", "typescript", "yaml"],
    }).then((instance) => {
      shikiState.highlighter = instance;
      return instance;
    });
  }
  return shikiState.promise;
}

async function ensureLanguage(): Promise<boolean> {
  if (shikiState.languageLoaded) return true;
  const instance = await loadHighlighter();
  await instance.loadLanguage(toLanguageRegistration());
  shikiState.languageLoaded = true;
  return true;
}

export async function highlightCode(code: string, language: string, theme: HighlightTheme): Promise<string | null> {
  const loaded = await ensureLanguage().catch((error) => {
    console.warn("Failed to load Welltale grammar", error);
    return false;
  });
  const instance = shikiState.highlighter;
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

function extractClassNames(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      out.push(...extractClassNames(item));
    }
    return out;
  }
  if (typeof value === "string") {
    return value.split(/\s+/).filter((item) => item.length > 0);
  }
  return [];
}

function isCommentElement(node: HastNode): boolean {
  if (!node || node.type !== "element") return false;
  const props = node.properties ?? {};
  const classes = extractClassNames((props as Record<string, unknown>).className);
  if (classes.includes("comment")) return true;
  const dataType = (props as Record<string, unknown>)["data-token-type"];
  if (typeof dataType === "string" && dataType.includes("comment")) return true;
  return false;
}

function highlightTemplateVariables(node: HastNode, inComment: boolean = false): void {
  if (!node || !node.children || node.children.length === 0) return;

  node.children = node.children.flatMap((child) => {
    const childComment = inComment || isCommentElement(child);
    if (!childComment && child.type === "text" && typeof child.value === "string") {
      const segments = splitTemplateSegments(child.value);
      if (segments.length === 1) return [child];
      return segments
        .map((segment) => {
          if (segment.isTemplate) return createTemplateSpan(segment.value);
          if (!segment.value) return null;
          return { type: "text", value: segment.value } as HastNode;
        })
        .filter(Boolean) as HastNode[];
    }

    if (child.children && child.children.length > 0) {
      highlightTemplateVariables(child, childComment);
    }
    return [child];
  });
}

function splitTemplateSegments(value: string) {
  const matches: { value: string; isTemplate: boolean }[] = [];
  const regex = /\{\{[^}]*\S[^}]*\}\}/g;
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
