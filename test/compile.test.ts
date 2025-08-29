import { readFileSync } from "fs";
import { dumpTree, fromFragment } from "lib/StoryCompiler";
import { join } from "path";

const main = readFileSync(
  join(__dirname, "..", "run", "cartridges", "welcome", "main.xml")
).toString("utf-8");
const tree = fromFragment(main);

console.log(dumpTree(tree));
