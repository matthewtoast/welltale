import { expect, runTestStory } from "./TestUtils";

async function testBlockOrder() {
  const xmlContent = `
<var id="stash-1" stash="true">
  K
  L
</var>

<p>
  A
</p>

<sec>
  <p>
    B
  </p>
  <p>
    C
  </p>
  <yield target="a-block" />
  <p>
    G
  </p>
</sec>

<block id="a-block">
  <p>
    D
  </p>
  <p>
    E
  </p>
  <p>
    F
  </p>
</block>

<sec>
  <p>
    H
  </p>
  <yield target="another-block" returnTo="meow" foo="bar" />
  <p>
    [NOT SHOWN]
  </p>
</sec>

<block id="another-block">
  <p>
    I {{foo}}
  </p>
</block>

<sec id="meow">
  <p>
    J
  </p>
  <p>
    {{stash-1}}
  </p>
  <code>
    wsl.set("em", "eminem");
    wsl.set("en", "nono");
  </code>
  <p>
    M {{em}}
  </p>
  <jump to="ruff" />
  <p>
    [NOT SHOWN]
  </p>
</sec>

<sec id="ruff">
  <p>
    N {{en}}
  </p>
  <p>
    O - shouldn't show blank var foo declared in block: ({{foo}})
  </p>
  <input pop.type="string" pop.default="" />
  <p>
    P - input should appear here = ({{input.pop}})
  </p>
  <p>
    [[Q 1|Q 2|Q 3]]
  </p>
  <!--
    here is a comment
  -->
  <p>
    S
  </p>
  <jump target="blub" />
</sec>

<sec id="blub">
  <!-- here is a comment -->
  <span>U</span>
  <scope>
    <var name="v" value="V" />
    <p>
      {{v}} - inner scope text [angry] with its own [sadly, wistfully] inner var
    </p>
  </scope>
  <p>
    W - but there should not be a 'v' variable here: ({{v}})
  </p>

  <var name="xx" />
  <while cond='wsl.blank(xx) || !xx.toLowerCase().startsWith("x")'>
    <p from="Bob">... Say a word beginning with the letter "x".</p>
    <input xx.type="string" xx.default="" />
    <var name="xx" value="{{input.xx}}" />
    <if cond='xx.toLowerCase() == "invalid1"'>
      <continue />
    </if>
    <while cond='true'>
      <break />
      <p>[NOT SHOWN]</p>
    </while>
  </while>

  <p>
    X - input finally started with x = "{{input.xx}}"
  </p>
  <jump to="when-test" />
</sec>

<sec id="when-test">
  <p>Y</p>
  
  <var name="testNum" value="5" />
  <var name="testBool" value="true" />
  <var name="testStr" value="hello" />
  <p>
    Z - Basic when tests:
    <when cond="testNum > 3">Number is greater than 3!</when>
    <when cond="testNum < 3">Number is less than 3!</when>
    <when cond="testNum == 5">Number equals 5!</when>
  </p>
  
  <p>
    AA
    <when cond="testBool">
      Outer when is true<when cond="testNum == 5">, and inner when is also true!</when>
    </when>
  </p>
  
  <p>
    BB
    <when cond="true">The value is {{testNum}} and string is {{testStr}}.</when>
  </p>
  
  <var name="testEmpty" value="" />
  <p>
    CC
    <when cond="wsl.blank(testEmpty)">Variable is empty!</when>
    <when cond="!wsl.blank(testStr)">String is not empty!</when>
  </p>
  
  <p>
    DD
  </p>
</sec>
`;

  const inputs = ["input1", "invalid1", "invalid2", "Xylophone"];
  const { ops, seam } = await runTestStory(xmlContent, inputs);

  const eventOps = ops.filter((op) => op.type === "play-media");
  const textEvents = eventOps.filter((op) => op.event && op.event.body);
  const textBodies = textEvents.map((e) => e.event!.body.trim());

  const expectedOrder = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I bar",
    "J",
    "K\nL",
    "M eminem",
    "N nono",
    "O - shouldn't show blank var foo declared in block: ()",
    "P - input should appear here = (input1)",
    "Q 2",
    "S",
    "U",
    "V - inner scope text [angry] with its own [sadly, wistfully] inner var",
    "W - but there should not be a 'v' variable here: ()",
    '... Say a word beginning with the letter "x".',
    '... Say a word beginning with the letter "x".',
    '... Say a word beginning with the letter "x".',
    'X - input finally started with x = "Xylophone"',
    "Y",
    "Z - Basic when tests:\nNumber is greater than 3!\nNumber equals 5!",
    "AA\nOuter when is true\n, and inner when is also true!",
    "BB\nThe value is 5 and string is hello.",
    "CC\nVariable is empty!\nString is not empty!",
    "DD",
  ];

  expect(textBodies.length, expectedOrder.length);

  for (let i = 0; i < expectedOrder.length; i++) {
    expect(textBodies[i], expectedOrder[i]);
  }

  const inputOps = ops.filter((op) => op.type === "get-input");
  expect(inputOps.length, 4);

  expect(seam, "finish");

  console.log("✓ block-order.test.ts passed");
}

testBlockOrder();
