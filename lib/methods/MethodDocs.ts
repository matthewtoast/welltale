import { PRNG } from "../RandHelpers";
import { arrayHelpers } from "./ArrayMethods";
import { dateHelpers } from "./DateMethods";
import { mathHelpers } from "./MathMethods";
import { MethodDef } from "./MethodHelpers";
import { createRandomHelpers } from "./RandMethods";
import { stringHelpers } from "./StringMethods";
import { unifiedHelpers } from "./UnifiedMethods";

export type MethodDocEntry = {
  name: string;
  description: string;
  example: string;
};

export type MethodDocGroup = {
  group: string;
  items: MethodDocEntry[];
};

function buildEntries(helpers: Record<string, MethodDef>): MethodDocEntry[] {
  return Object.keys(helpers)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      name: `wsl.${key}`,
      description: helpers[key].doc,
      example: helpers[key].ex,
    }));
}

export function buildMethodDocGroups(): MethodDocGroup[] {
  const randomHelpers = createRandomHelpers(new PRNG("docs"));

  const groups: MethodDocGroup[] = [
    { group: "Utilities", items: buildEntries(unifiedHelpers) },
    { group: "Arrays", items: buildEntries(arrayHelpers) },
    { group: "Strings", items: buildEntries(stringHelpers) },
    { group: "Numbers", items: buildEntries(mathHelpers) },
    { group: "Dates", items: buildEntries(dateHelpers) },
    {
      group: "Randomness (via deterministic seeded PRNG)",
      items: buildEntries(randomHelpers),
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}
