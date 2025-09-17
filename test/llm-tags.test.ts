import { expect, runTestStory } from "./TestUtils";

async function testLLMTags() {
  const xmlContent = `
<input />

<p>
  LLM tag demo. User said: "{{input}}"
</p>

<!--
parses the given inner text, per the types specified.
for tags without dot-based (.) grouping, assume string is the type and the value is a description.
result is stored in ctx.scope.parse unless key attribute is given, in which case ctx.scope[key]
can also use $models=""
-->
<llm:parse
  key="myParseResult"
  summary="a summary of the text"

  wasMarvelousWordSus.type="number"
  wasWordMarvelousSus.description="If the player used the word 'marvelous' in their input, please judge whether it was natural or not by returning a score between 0.0 and 1.0. If they didn't use the word, return 0."

  didAskToUseBathroom.type="boolean"
  didAskToUseBathroom.description="Did the player make request to go to the bathroom ('i need to go freshen up', 'i'll be right back', 'i'm going to use the ladies room' etc)? Return true/false"
>
  {{input}}
</llm:parse>

<log message="PARSE: {{myParseResult}}" />

<!--
classifies the text returning only string of one of the given classifications as enumerated in the attributes
result is stored in ctx.scope.classify unless key attribute is present, in which case ctx.scope[key]
-->
<llm:classify
  rewind="requested rewind like go back to a certain point in the story"
  smalltalk="general pleasantries or chit-chat"
  greeting="user is greeting"
  >
  {{input}}
</llm:classify>

<log message="CLASSIFY: {{classify}}" />

<!--
returns a score between 0.0 and 1.0 for each attribute.
object with results stored in ctx.scope.score unless key is given
-->
<llm:score
  key="foobar"
  isQuestion="is it a question"
  isAngry="does the message seem angry"
  aboutFish="is the message having anything to do with fish?">
  {{input}}
</llm:score>

<log message="SCORE: {{foobar}}" />

<!--
very similar to <llm:parse> except job is to *generate* data. mainly a semantic distiction despite the mechanics being similar.
the underlying prompt might be slightly different than llm:parse tailored more to generating than parsing
-->
<llm:generate
  key="gen"
  title.description="Short catchy title"
  title.type="string"
  tags.description="List three tags"
  tags.type="array<string>"
>
  Write a short title and three tags about the given input.
  Input: {{input}}
</llm:generate>

<log message="GENERATE: {{gen}}" />
`;

  const { ops, seam } = await runTestStory(xmlContent, ["hello there"]);
  
  const eventOps = ops.filter(op => op.type === "play-event");
  const textEvents = eventOps.filter(op => op.event && op.event.body);
  const textBodies = textEvents.map(e => e.event.body.trim());
  
  expect(textBodies.length, 1);
  expect(textBodies[0], 'LLM tag demo. User said: "hello there"');
  
  expect(seam, "finish");
  
  console.log("✓ llm-tags.test.ts passed");
}

testLLMTags().catch(console.error);
