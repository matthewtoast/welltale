import { highlightCode } from "../../lib/WelltaleSyntaxHighlighterShiki";

type HighlightTheme = "github-light" | "github-dark";

interface CodeBlockProps {
  code: string;
  language: string;
  className: string;
  theme: HighlightTheme;
}

export async function CodeBlock({ code, language, className, theme }: CodeBlockProps) {
  const highlighted = await highlightCode(code, language, theme);
  if (highlighted === null) {
    return (
      <pre className={className}>
        <code>{code}</code>
      </pre>
    );
  }
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: highlighted }} />
  );
}
