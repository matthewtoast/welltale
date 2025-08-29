import dedent from "dedent";
import { markdownToTree } from "lib/StoryCompiler";
import { dumpTree } from "lib/TreeDumper";

function testCase(name: string, markdown: string) {
  console.log(`\n=== ${name} ===`);
  console.log(`Input:\n${markdown}`);
  console.log(`\nOutput:`);
  console.log(dumpTree(markdownToTree(markdown).root));
}

// Test 1: Basic formatting - should merge into single text
testCase(
  "Basic formatting",
  dedent`
  # hi
  Welcome to **my place**, sir \`Walter\` Raleigh!
`
);

// Test 2: Mixed content with flow control - should group text but preserve flow
testCase(
  "Mixed content with flow control",
  dedent`
  # greeting
  Hello **there**, <if cond="formal">sir</if> Walter!
`
);

// Test 3: Multiple flow elements - should create multiple text groups
testCase(
  "Multiple flow elements",
  dedent`
  # complex
  Start **bold** text, <input to="name" as="string" /> then _italic_ and <jump to="end" /> finally done.
`
);

// Test 4: Pure text - should remain unchanged
testCase(
  "Pure text",
  dedent`
  # simple
  Just plain text here.
`
);

// Test 5: Nested formatting - should handle complex markdown
testCase(
  "Nested formatting",
  dedent`
  # complex formatting
  This has **bold with _italic_ inside** and \`code\` too.
`
);

// Test 6: Flow control only - no text grouping needed
testCase(
  "Flow control only",
  dedent`
  # flow only
  <if cond="true">
    <jump to="somewhere" />
  </if>
`
);

// Test 7: Adjacent paragraphs with different patterns
testCase(
  "Adjacent paragraphs",
  dedent`
  # multiple paragraphs
  
  This is **plain** formatting.
  
  But this has <input to="test" /> flow control.
  
  And this is **just** formatting again.
`
);
