export type FieldSpec = {
  type?: string;
  parse?: string;
  pattern?: string;
  default?: string;
  make?: string;
};

export function parseFieldGroups(
  atts: Record<string, string>
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const key in atts) {
    const [group, ...rest] = key.split(".");
    if (rest.length < 1) {
      continue;
    }
    if (!result[group]) result[group] = {};
    result[group][rest.join(".")] = atts[key];
  }
  return result;
}

export type NestedStringRecord = string | { [key: string]: NestedStringRecord };

export function parseFieldGroupsNested(
  atts: Record<string, string>
): Record<string, NestedStringRecord> {
  const result: Record<string, NestedStringRecord> = {};
  for (const key in atts) {
    const parts = key.split(".");
    let curr: Record<string, NestedStringRecord> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (
        typeof curr[parts[i]] !== "object" ||
        curr[parts[i]] === null ||
        typeof curr[parts[i]] === "string"
      ) {
        curr[parts[i]] = {};
      }
      curr = curr[parts[i]] as Record<string, NestedStringRecord>;
    }
    curr[parts[parts.length - 1]] = atts[key];
  }
  return result;
}
