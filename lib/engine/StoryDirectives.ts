export const DIRECTIVES: Record<string, string> = {
  stdlib: `
<macro match="input:confirm">
  <rename to="input" />
  <set attr="answer.type" value="boolean" />
  <set attr="answer.description" value="true if the user said 'yes', 'let's go', 'why not', 'はい', 'ok', 'one more time', 'proceed', 'sí', 'confirm', (etc) or anything indicating the affirmative; false if not" />
</macro>
`,
};

export function injectDirectives(src: string): string {
  for (const key in DIRECTIVES) {
    const directive = `\n<<${key}>>\n`;
    const replacement = DIRECTIVES[key];
    src = src.replaceAll(directive, `\n${replacement}\n`);
  }
  return src;
}
