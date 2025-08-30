import { dumpTree, parseXmlFragment } from "lib/StoryCompiler";
import { expect } from "./TestUtils";

const t2 = parseXmlFragment(`
  <p>yay</p>
  <sec id="foo">
    <p>hi</p>
  </sec>
  <var var="x" value="1" />
  <p>meow</p>
  <p>cow</p>
`);

expect(
  dumpTree(t2),
  `
<root>
  <p>yay</p>
  <sec id="foo" id="foo">
    <p>hi</p>
  </sec>
  <var var="x" value="1" />
  <p>meow</p>
  <p>cow</p>
</root>
`.trim()
);
