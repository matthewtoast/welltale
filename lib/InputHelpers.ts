export type FieldSpec = {
  type?: string;
  parse?: string;
  pattern?: string;
  default?: string;
  make?: string;
  error?: string;
};

export function parseFieldGroups(
  atts: Record<string, string>
): Record<string, FieldSpec> {
  const re =
    /^(?<field>[^\.]+)\.(?<prop>type|parse|pattern|default|make|error)$/;
  const groups: Record<string, FieldSpec> = {};
  for (const k in atts) {
    const m = k.match(re);
    if (!m || !m.groups) continue;
    const f = m.groups.field;
    const p = m.groups.prop as keyof FieldSpec;
    groups[f] = groups[f] || {};
    groups[f][p] = atts[k];
  }
  return groups;
}
