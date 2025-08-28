import dedent from "dedent";
import { markdownToTree } from "lib/NodeHelpers";
import { dumpTree } from "lib/TreeDumper";

console.log(
  dumpTree(
    markdownToTree(dedent`
      # hi
      Welcome to **my place**, sir \`Walter\` Raleigh!
    `).root
  )
);

/*
The output is:
<root id="0">
  <h1 id="0.0">hi</h1>
  <text id="0.1" />
  <p id="0.2">
    <text id="0.2.0">Welcome to</text>
    <strong id="0.2.1">my place</strong>
    <text id="0.2.2">, sir</text>
    <code id="0.2.3">Walter</code>
    <text id="0.2.4">Raleigh!</text>
  </p>
</root

But I'd like it to be
<root id="0">
  <h1 id="0.0">hi</h1>
  <text id="0.1" />
  <p id="0.2">
    Welcome to **my place**, sir `Walter` Raleigh!
  </p>
</root>
*/
