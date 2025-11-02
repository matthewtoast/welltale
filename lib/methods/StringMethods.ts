import {
  camel,
  capFirst,
  kebab,
  MethodDef,
  num,
  P,
  snake,
  toArr,
  toStr,
  unCapFirst,
} from "./MethodHelpers";

export const stringHelpers: Record<string, MethodDef> = {
  capitalize: {
    doc: "Returns capitalized form of the given string",
    ex: 'wsl.capitalize("bear") //=> "Bear"',
    fn: (v: P) => capFirst(toStr(v).toLowerCase()),
  },
  uncapitalize: {
    doc: "Returns uncapitalized form of the given string",
    ex: 'wsl.uncapitalize("Bear") //=> "bear"',
    fn: (v: P) => unCapFirst(toStr(v)),
  },
  titleCase: {
    doc: "Returns title case form of the given string",
    ex: 'wsl.titleCase("hello world") //=> "Hello World"',
    fn: (v: P) =>
      toStr(v).replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
      ),
  },
  kebabCase: {
    doc: "Returns kebab-case form of the given string",
    ex: 'wsl.kebabCase("helloWorld") //=> "hello-world"',
    fn: (v: P) => kebab(toStr(v)),
  },
  snakeCase: {
    doc: "Returns snake_case form of the given string",
    ex: 'wsl.snakeCase("helloWorld") //=> "hello_world"',
    fn: (v: P) => snake(toStr(v)),
  },
  camelCase: {
    doc: "Returns camelCase form of the given string",
    ex: 'wsl.camelCase("hello-world") //=> "helloWorld"',
    fn: (v: P) => camel(toStr(v)),
  },
  listize: {
    doc: "Converts array to natural language list",
    ex: 'wsl.listize(["a", "b", "c"]) //=> "a, b and c"',
    fn: (arr: P[], sep?: P, lastSep?: P) => {
      const t = toArr(arr).map(toStr);
      if (!t.length) return "";
      if (t.length === 1) return t[0];
      const s = toStr(sep ?? ", ");
      const l = toStr(lastSep ?? " and ");
      return t.slice(0, -1).join(s) + l + t[t.length - 1];
    },
  },
  pluralize: {
    doc: "Returns plural form of word based on count",
    ex: 'wsl.pluralize("cat", 2) //=> "cats"',
    fn: (word: P, count: P, pluralForm?: P) => {
      const w = toStr(word);
      const n = num(count);
      if (n === 1) return w;
      return pluralForm == null ? w + "s" : toStr(pluralForm);
    },
  },
  ordinalize: {
    doc: "Returns ordinal form of number",
    ex: 'wsl.ordinalize(21) //=> "21st"',
    fn: (n: P) => {
      const v = Math.abs(num(n));
      const s = ["th", "st", "nd", "rd"];
      const v10 = v % 100;
      return v + (s[(v10 - 20) % 10] || s[v10] || s[0]);
    },
  },
};
