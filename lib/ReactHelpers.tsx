export function textWithBracketsToSpans(
  text: string,
  normalSpanStyle: React.CSSProperties,
  bracketSpanStyle: React.CSSProperties
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("[", i);
    if (open === -1) {
      if (i < text.length) {
        parts.push(
          <span style={normalSpanStyle} key={parts.length}>
            {text.slice(i)}
          </span>
        );
      }
      break;
    }
    if (open > i) {
      parts.push(
        <span style={normalSpanStyle} key={parts.length}>
          {text.slice(i, open)}
        </span>
      );
    }
    const close = text.indexOf("]", open);
    if (close === -1) {
      parts.push(
        <span style={normalSpanStyle} key={parts.length}>
          {text.slice(open)}
        </span>
      );
      break;
    }
    parts.push(
      <span style={bracketSpanStyle} key={parts.length}>
        {text.slice(open, close + 1)}
      </span>
    );
    i = close + 1;
  }
  return parts;
}
