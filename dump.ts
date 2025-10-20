import { readFileSync, writeFileSync } from "fs";
import { renderContext } from "./lib/WelltaleKnowledgeContext";
async function __go() {
  const thiscontent = readFileSync(__filename).toString();
  const splitvar = ["__go", "();"].join("");
  const [first] = thiscontent.split(splitvar).map((s) => s.trim());
  const rider = await renderContext();
  const updated = [first, splitvar, `/*\n${rider}\n*/`].join("\n");
  writeFileSync(__filename, updated);
}
__go();
/*
Welltale's README, with an overview and explanation:
~~~~~
# Welltale

Welltale is an interactive audio story platform — think audio books or podcasts, but interactive, dynamic, and responsive. (Or, think games - but audio only.) It combines voice, sound, and interactivity (with support for generative AI out of the box) to create stories that adapt to the listener's choices.

## Welltale Story Language

The foundation of Welltale is the Welltale Story Language (WSL). WSL is a lightweight XML-based format designed to make authoring interactive audio stories intuitive and readable. It’s expressive enough for complex branching logic, yet simple enough to write by hand. Each story is made up of one or more `.wsl` files.

Here’s a minimal example:

```xml
<intro>
  <music duration="8000" background="true">
    Gentle fantasy music with strings and flutes
  </music>

  <p voice="narrator">
    Welcome to My Dooramatic Choice, an interactive story.
  </p>

  <jump to="door" />
</intro>

<var name="attempts" type="number" value="0" />

<div id="door">
  <p voice="narrator">
    You stand before two doors: one of oak, one of stone.
    Which will you open?
  </p>

  <input key="choice" />

  <llm:score
    key="score"
    oak="the user chose the oak door"
    stone="the user chose the stone door">
    Here's what the user said: {{choice}}
    Score whether the user chose the oak or stone door.
  </llm:tag>

  <script>
    set("attempts", attempts + 1)
  </script>

  <if cond="score.oak > score.door">
    <jump to="oak" />
  </if>
  <jump to="stone" />
</div>

<div id="stone">
  <p voice="narrator">
    The stone door doesn't budge.
    <when cond="attempts > 5">
      That was your {$ ordinalize(attempts) $} attempt.
      Perhaps you should give the other door a try.
    </when>
  </p>

  <jump to="door" />
</div>

<div id="oak">
  <p voice="narrator">
    You push open the oak door.
    The door's hinges [[creak|groan|emit a squeak]] as it opens.
  </p>

  <p voice="narrator">
    You peer inside. You see {%
      An adventurer in a fantasy world just opened an oak door.
      Describe what they see inside in a short, florid paragraph.
    %}
  </p>

  <!-- TODO: Write more of the story -->
</div>
```

WSL supports many other expressions including loops, function-like blocks, scope, conditional text occlusion, a number of LLM-powered tags, and even macros. A sandboxed JavaScript environment is provided for scripting. For a list of all tags and structures, see the Welltale Story Language Reference.

## Vision

Stories can be short or endless, linear or branching, purely human-written or partially AI-generated. WSL makes it easy to combine authored structure with AI creativity — generating dialogue, voices, music, and even story content on the fly. _The only limit... is your imagination!™_

~~~~~
Documentation on all supported special XML tags in Welltale:
~~~~~
Tag: <p>
Desc: Text content elements contain narration, dialogue - any content that gets played as spoken audio to the player.
This content is rendered into audio clips automatically by Welltale using text-to-speech, and then played on the story client to the player.
The `name` attribute can be used to indicate the person speaking. If none given, `"HOST"` is used.
The `voice` attribute can assign a specific text-to-speech voice to the speech. If none is given, the default voice (the one used for \"HOST\") is used. Voices are defined in data files (data.yml or data.json) in your story directory.
Warning: The only tag you can place inside of a text content element is `<when>`. See the docs on `<when>` for adding expressive conditional logic to your text elements.
Attrs: {"name":{"type":"string","desc":"Speaker/character name","req":false,"default":"HOST"},"voice":{"type":"string","desc":"Voice ID for text-to-speech generation","req":false},"to":{"type":"string","desc":"Comma-separated list of recipients who hear this","req":false,"default":"PLAYER"},"obs":{"type":"string","desc":"Comma-separated list of observers who witness but don't hear directly","req":false},"tags":{"type":"string","desc":"Comma-separated tags affecting speech generation","req":false},"volume":{"type":"number","desc":"Volume level from 0.0 to 1.0","req":false},"background":{"type":"boolean","desc":"Play narration in background without blocking","req":false,"default":"false"},"fadeAt":{"type":"number","desc":"Start fading at this time in milliseconds","req":false},"fadeDuration":{"type":"number","desc":"Duration of fade in milliseconds","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <input>
Desc: Pauses story execution to get input from the user.
If the input can't be validated from attributes alone, AI will automatically be used to parse and validate the input.
Raw input is stored in the `input` state variable. Extracted fields are stored under the `_` state variable, or the variable given by the `key` attribute if present.
Note: Every `<input>` automatically create a story checkpoint.
Attrs: {"id":{"type":"string","desc":"Unique identifier for this input point","req":false},"scope":{"type":"string","desc":"Set to 'global' to store extracted values in global state","req":false,"default":"local"},"retryMax":{"type":"number","desc":"Maximum retry attempts if extraction fails","req":false,"default":"3"},"catch":{"type":"string","desc":"ID of element to jump to if all retries fail","req":false},"[field].description":{"type":"string","desc":"Description for AI to extract this field from input","req":false},"[field].type":{"type":"string","desc":"Expected type: string, number, boolean","req":false,"default":"string"},"[field].default":{"type":"string","desc":"Default value if field not found in input","req":false}}

Tag: <var>
Desc: Defines or updates a variable in the current scope. Variables can hold any type of data
and can be used in template expressions like `{{variableName}}`.
Attrs: {"name":{"type":"string","desc":"Variable name (aliases: key, id)","req":true},"value":{"type":"string","desc":"Value to assign. Can be literal or expression. If omitted, uses inner content.","req":false},"type":{"type":"string","desc":"Type to cast value to: string, number, boolean, array, object, date","req":false,"default":"string"}}

Tag: <if>
Desc: Conditional execution of story content. Evaluates a JavaScript expression and executes
child elements only if the condition is true.
Note: `<else>` blocks are supported, but they must be _inside_ the `<if>` block.
`<else>` tags that appear outside of `<if>` will be ignored.
Attrs: {"cond":{"type":"string","desc":"JavaScript expression to evaluate. Has access to all scope variables.","req":true}}

Tag: <jump>
Desc: Navigates to another section of the story by ID. Can be conditional using the 'if' attribute.
The target must be an element with an id attribute (typically `<div>` elements, but can be any type of element).
This is the primary way to implement branching narratives and story choices.
Attrs: {"to":{"type":"string","desc":"ID of the target element to jump to (aliases: target, destination)","req":true},"if":{"type":"string","desc":"JavaScript condition that must be true for the jump to execute","req":false}}

Tag: <script>
Desc: Executes JavaScript with access to state variables in the current scope.
State variables can be read and modified directly using `get(key)` and `set(key, value)`.
Code runs in a sandboxed environment.
Attrs: {}

Tag: <sleep>
Desc: Pauses story execution for a specified duration. Useful for dramatic timing, letting
audio play, or creating rhythm in the narrative. The duration is in milliseconds.
Note: During sleep, background audio continues playing.
Attrs: {"duration":{"type":"number","desc":"Pause duration in milliseconds (aliases: for, ms)","req":false,"default":"1"}}

Tag: <while>
Desc: Repeats child elements while a condition remains true. The condition is evaluated before
each iteration. Supports `<break>` and `<continue>` statements for loop control.
Attrs: {"cond":{"type":"string","desc":"JavaScript expression evaluated before each iteration","req":true}}

Tag: <sound>
Desc: Plays audio content in the story.
If a `url` attribute is given, it is played directly.
Otherwise the prompt (inner text content) is used, and the chosen tag determines the type:
- `<sound>` or `<audio>`: Sound effects
- `<music>`: Music clip
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attributes can used for volume control, fading, etc.
Attrs: {"src":{"type":"string","desc":"URL of audio file to play (aliases: href, url)","req":false},"duration":{"type":"number","desc":"Duration in milliseconds for AI-generated audio","req":false,"default":"5000 for sound, 10000 for music"},"prompt":{"type":"string","desc":"Description for AI audio generation (aliases: make, description)","req":false},"background":{"type":"boolean","desc":"Play audio in background without blocking story flow","req":false,"default":"false"},"volume":{"type":"number","desc":"Volume level from 0.0 to 1.0","req":false,"default":"1.0"},"fadeAt":{"type":"number","desc":"Start fading at this time in milliseconds","req":false},"fadeDuration":{"type":"number","desc":"Duration of fade in milliseconds","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <root>
Desc: Many container elements are available to structure the story content.
They can contain any other tags to arbitrary depth.
These tags organize the narrative into logical sections and can contain other tags.
Attrs: {"id":{"type":"string","desc":"Unique identifier for navigation and jumping","req":false}}

Tag: <llm:text>
Desc: Generates unstructured text content using AI based on a prompt. This is useful for creating
narrative content, descriptions, dialogue, or any text that doesn't need to be parsed into
structured data. The generated text is stored as a simple string.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attrs: {"key":{"type":"string","desc":"Variable name to store the generated text (default: 'text')","req":false,"default":"text"},"web":{"type":"boolean","desc":"Enable web search for current information during generation","req":false,"default":"false"},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <llm:tag>
Desc: Classifies input text into predefined categories using AI.
The tag analyzes the text content and returns an array of matching labels based on their
descriptions. Each attribute becomes a potential label with its value serving as the description
for classification.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
The AI returns only the labels that match the content, supporting multiple label assignment.
Attrs: {"key":{"type":"string","desc":"Variable name to store the array of matching labels (default: 'tags')","req":false,"default":"tags"},"web":{"type":"boolean","desc":"Enable web search for current information during classification","req":false,"default":"false"},"[label]":{"type":"string","desc":"Label name as attribute, description as value. AI returns labels that match.","req":false}}

Tag: <llm:score>
Desc: Scores text content on multiple dimensions using AI. Each attribute becomes a scoring dimension,
and the AI returns a numeric score between `0.0` and `1.0` for each dimension. This is useful for
sentiment analysis, content moderation, or any scenario requiring quantitative text evaluation.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attrs: {"key":{"type":"string","desc":"Variable name to store the scores object (default: 'score')","req":false,"default":"score"},"web":{"type":"boolean","desc":"Enable web search for fact-checking during scoring","req":false,"default":"false"},"[dimension]":{"type":"string","desc":"Scoring dimension name as attribute, description as value. Returns 0.0-1.0 score.","req":false}}

Tag: <llm:moderate>
Desc: Evaluates text against safety categories and returns scores plus a flagged status.
Provide an input body and optionally adjust the moderation threshold. A flagged result becomes
true when any category score exceeds the threshold.
Attrs: {"key":{"type":"string","desc":"Variable name to store moderation result (default: 'moderation')","req":false,"default":"moderation"},"threshold":{"type":"number","desc":"Flag when any category score is above this value","req":false,"default":"0.5"},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false}}

Tag: <llm:parse>
Desc: Extracts structured data from text content using AI. The tag analyzes the inner text and extracts
values according to a schema defined by the attributes. Each attribute becomes a field in the extracted
data, with optional type and description properties specified using dot notation.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attrs: {"key":{"type":"string","desc":"Variable name to store the extracted data (default: 'parse')","req":false,"default":"parse"},"web":{"type":"boolean","desc":"Enable web search as the AI extracts the data","req":false,"default":"false"},"[field]":{"type":"string","desc":"Simple field: attribute name becomes field name, value becomes description","req":false},"[field].type":{"type":"string","desc":"Field type: string, number, boolean, array<string>, etc.","req":false,"default":"string"},"[field].description":{"type":"string","desc":"Detailed description of what to extract for this field","req":false},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <llm:generate>
Desc: Generates structured content using AI based on instructions and a schema.
Unlike `<llm:parse>` which extracts data from existing text, this tag creates new content
according to specifications. Supports complex nested structures and various data types.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attrs: {"key":{"type":"string","desc":"Variable name to store the generated data (default: 'generate')","req":false,"default":"generate"},"web":{"type":"boolean","desc":"Enable web search for current information during generation","req":false,"default":"false"},"[field]":{"type":"string","desc":"Simple field: attribute name becomes field name, value becomes description","req":false},"[field].type":{"type":"string","desc":"Field type: string, number, boolean, array<string>, etc.","req":false,"default":"string"},"[field].description":{"type":"string","desc":"Detailed description of what to generate for this field","req":false},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <llm:line>
Desc: Generates a single NPC response using recent conversation history. The tag gathers
relevant dialog between the NPC and listed participants, then prompts an LLM to
produce the next line without a speaker prefix.
You must tag your input and output tags (e.g. <input> and <p>) with the `from` attribute
and reference those in the <llm:line> tag's `as` and `with` for this tag to function.
The `as` attribute is the NPC who is replying, whereas the `` with is a comma-delimited
list of others with whom that NPC is talking.
Attrs: {"as":{"type":"string","desc":"Name of the speaker generating this line","req":true},"with":{"type":"string","desc":"Comma-separated list of other participants to include in history","req":false},"key":{"type":"string","desc":"Variable name to store the generated line (default: 'line')","req":false,"default":"line"},"limit":{"type":"number","desc":"Maximum number of recent dialog lines to include (default: 12)","req":false},"web":{"type":"boolean","desc":"Enable web search during generation","req":false,"default":"false"},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <block>
Desc: Defines a reusable content block that can be invoked with `<yield>`. Blocks are skipped during
normal story flow and only execute when explicitly yielded to. They can receive parameters
from the `<yield>` tag, making them similar to functions in programming.
Attrs: {"id":{"type":"string","desc":"Unique identifier for the block, used by yield tags to invoke it","req":true}}

Tag: <yield>
Desc: Invokes a defined `<block>` with optional parameters. Acts like a function call, jumping to the
block's content with the provided parameters available as variables. After the block completes,
execution returns to the point after the `<yield>` tag — or to a specified return point
specified by the `returnTo` attribute.
For examples, see `<block>`.
Attrs: {"to":{"type":"string","desc":"ID of the block to yield to (alias: target)","req":true},"return":{"type":"string","desc":"ID of element to jump to after block completes (alias: returnTo)","req":false},"[param]":{"type":"string","desc":"Parameters passed to the block as variables","req":false}}

Tag: <scope>
Desc: Creates a new state variable scope for child elements. State variables defined within the scope are
isolated and don't affect the parent scope. Useful for temporary variables, loop iterations,
or any situation where you want to prevent variable pollution.
Attrs: {}

Tag: <macro>
Desc: Macros allow you to create shorthand notation that expands into full story elements.
They're processed at runtime and applied to matching patterns throughout the story content.
Attrs: {"match":{"type":"string","desc":"Tag name pattern to match for macro expansion","req":true}}

Tag: <include>
Desc: When the compiler sees an `<include>` tag, it replaces it with the content within the node
that has the given `id` attribute.
Attrs: {"id":{"type":"string","desc":"ID of the element to include","req":true}}

Tag: <when>
Desc: The `<when>` tag is a special tag used to conditionally render text content.
Unlike the runtime `<if>` tag, which controls story flow, `<when>` operates only when text is being prepared to render.
It cannot be used outside of text content tags.
It is useful when you want to provide an LLM prompt but want to omit content until conditions are met.
Attrs: {"cond":{"type":"string","desc":"JavaScript expression to evaluate for content inclusion","req":true}}

Tag: <data>
Desc: Loads structured data from JSON or YAML format, either from the tag's content or from a URL.
Useful for loading configuration, game data, or any structured information. The data is stored
in the state variable given by the `key` attribute.
Attrs: {"key":{"type":"string","desc":"Variable name to store the loaded data","req":false,"default":"data"},"src":{"type":"string","desc":"URL to load data from (aliases: href, url)","req":false},"format":{"type":"string","desc":"Data format: json or yaml/yml. Auto-detected from content-type if loading from URL.","req":false,"default":"json"},"method":{"type":"string","desc":"HTTP method when loading from URL","req":false,"default":"GET"}}

Tag: <checkpoint>
Desc: Creates a save point in the story that users can resume from. Checkpoints store the current
state, variables, and conversation history.
Note: Checkpoits are automatically created at section boundaries
and before input prompts, but can also be manually placed for important story moments.
Attrs: {}

Tag: <intro>
Desc: Defines content that plays at the start of a story or when starting fresh. Typically contains
introductory narration, music, or scene-setting. This content is skipped when resuming a saved
story. Only one intro section should exist per story file.
Attrs: {}

Tag: <outro>
Desc: Defines content that plays when a story ends. Can contain credits, final narration, or
closing music. The outro is triggered by the story engine when reaching a story endpoint.
Attrs: {}

Tag: <resume>
Desc: Defines content that only plays when resuming a saved story. Useful for recaps, reminders,
or re-establishing context. This content is skipped during normal story flow and only
executes when a user returns to a saved checkpoint.
Attrs: {}

Tag: <end>
Desc: Immediately ends the story. If an `<outro>` block exists, it will be played before ending.
This tag provides explicit story termination points for branching narratives.
Attrs: {}

Tag: <exit>
Desc: Immediately exits the story without playing any outro. Use this for abrupt endings or 
when you want to skip the outro entirely. Compare with `<end />` which plays the outro if present.
Attrs: {}

Tag: <read>
Desc: Reads and narrates text content from a URL or inline content.
Attrs: {"src":{"type":"string","desc":"URL to fetch text content from (aliases: href, url)","req":false},"from":{"type":"string","desc":"Speaker/character reading the text (aliases: speaker, label)","req":false,"default":"HOST"},"voice":{"type":"string","desc":"Voice ID to use for narration","req":false},"to":{"type":"string","desc":"Comma-separated list of recipients","req":false,"default":"PLAYER"},"tags":{"type":"string","desc":"Comma-separated tags for the narration","req":false},"volume":{"type":"number","desc":"Volume level from 0.0 to 1.0","req":false},"background":{"type":"boolean","desc":"Play narration in background","req":false,"default":"false"},"fadeAt":{"type":"number","desc":"Start fading at this time in milliseconds","req":false},"fadeDuration":{"type":"number","desc":"Duration of fade in milliseconds","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <image>
Desc: Displays images in the story.
If a `src`, `href`, or `url` attribute is given, it displays that image directly.
Otherwise the prompt (inner text content) is used to generate an image using AI.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attrs: {"src":{"type":"string","desc":"URL of image file to display (aliases: href, url)","req":false},"model":{"type":"string","desc":"Image generation model to use for AI-generated images","req":false},"aspectRatio":{"type":"string","desc":"Aspect ratio for AI-generated images (e.g., '16:9', '1:1')","req":false},"prompt":{"type":"string","desc":"Description for AI image generation (aliases: make, description)","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <log>
Desc: Outputs debug information to the console. Useful for story development and debugging.
Can display messages, variable values, or dump the entire current state. Only visible
in development mode; not shown to end users.
Attrs: {"message":{"type":"string","desc":"Message to log. If omitted, uses inner content.","req":false},"dump":{"type":"boolean","desc":"Dump full context including attributes, session, options, and scope","req":false,"default":"false"}}
~~~~~
Documentation on template pattern syntax in Welltale:
~~~~~
Syntax: {{variable}}
Desc: Insert state variable values into your text using Handlebars-like syntax. Variables may be strings, numbers, or booleans.

Syntax: {$ expression $}
Desc: Evaluate JavaScript expressions and insert the result. You can do math, call functions, or create logic.

Syntax: [[dynamic|text|variations]]
Desc: Create dynamic text variations that change each time they're encountered. Use pipe symbols to separate options. Add ^ for cycling through options in order, or ~ for shuffled rotation.

Syntax: {% prompt %}
Desc: Generate text using AI based on your prompt. The AI creates content that fits naturally into your story.

Syntax: Pattern processing order - important
Desc: Templates are processed in this specific order: (1) {{variables}} first, (2) {$ expressions $} second, (3) [[random|variations]] third, (4) {% AI prompts %} last. Later patterns can use results from earlier ones.
~~~~~
A longer Welltale story example, showcasing usage of multiple tags:
~~~~~
=== data.yml ===
```yml
# Data files (.yml, .yaml, or .json) define story metadata and configuration.
# The engine automatically loads all data files in your story directory.

# Basic story metadata - this is displayed in your public story listing
title: Example Quest
author: Matthew Trost
tags: [example, fantasy]
description: This example Welltale story shows how to use all Welltale Story Language features.

# Pronunciation mappings for the speech engine - for any less common words or fantastical terms
pronunciations:
  Trost: Troast
  Examplaria: exampLAHria

# Game data - you can define any custom data your story needs and reference it
# in template patterns like {{player.gold}} or scripts like <code>shop.potion * 3</code>
player:
  gold: 35
  inventory: ["bread"]

shop:
  potion: 30
  compass: 50
  sword: 20

# Macros are now defined directly in story files using <macro> tags
# These transform your tags based on rules to make story authoring easier

# Voices are defined in data files using this format
voices:
  narrator:
    prompt: British storybook narrator, classic deep voice, expressive
  merchant:
    prompt: Jovial merchant in a fantasy setting, slight Eastern European accent, persuasive
  rhymer:
    prompt: Swamp creature that speaks only in rhyme, melodic voice, slightly mischievous
  wretch:
    prompt: Wretched forest creature, lowly British accent, voice like a whisper through clenched teeth
  troll:
    prompt: Large deep-voiced troll with a growl, hungry and menacing, British accent

```

=== main.wsl ===
```wsl
<!-- This is an example interactive audio story written in Welltale Story Language (WSL). -->

<!-- The <intro> tag plays content only once: when the player first begins a story. -->
<intro>
  <!-- The <music> tag generates a music clip according to a prompt -->
  <music duration="10000" background="true">
    Epic fantasy orchestral music for the beginning of an exciting, dangerous quest
  </music>

  <!-- <sleep> is used for creating a timed pause in the story flow, useful for building suspense -->
  <sleep duration="3000" />

  <!--
    The <p> tag plays spoken content, automatically converting the text to speech.
    You can use {{ }} template pattern to inject dynamic content into your text.
    Here, we are referencing values defined in our data.yml file.
  -->
  <p>
    You're playing {{title}}, by {{author}}.
  </p>
</intro>

<!-- The <resume> tag plays content any time a story is resumed. It does not play on the first playthrough. -->
<resume>
  <!-- If no `voice` is specified, a default voice will be used. -->
  <p>
    Welcome back to {{title}}, by {{author}}.
  </p>
</resume>

<!-- Macro definitions - these transform tags to make story authoring easier -->
<macro match="merchant">
  <rename to="p" />
  <set attr="voice" value="merchant" />
</macro>

<macro match="rhymer">
  <rename to="p" />
  <set attr="voice" value="rhymer" />
</macro>

<macro match="wretch">
  <rename to="p" />
  <set attr="voice" value="wretch" />
</macro>

<macro match="troll">
  <rename to="p" />
  <set attr="voice" value="troll" />
  <set attr="from" value="troll" />
</macro>

<!--
  The <origin> tag defines your story's actual starting point. It only plays once per story.
  It plays after the <intro> tag; or, if no <intro> tag is present, it played first.
  If no <origin> tag is given then playback will begin with the first top-level tag.
-->
<origin>
  <!-- The `voice` attribute here specifies the generated voice to use -->
  <p voice="narrator">
    Dark forces gather in the land of Examplaria.
  </p>
  
  <p voice="narrator">
    You've arrived at an ancient crossroads in the wilderness. The sun is setting.
    Two paths lie before you: one leads into a dark forest, the other toward a misty swamp.
    Which path do you choose?
  </p>

  <!--
    With the <input> tag, the story pauses to collect the user's input.
    Their input gets stored in an `input` state variable, which you can use in your story logic.
  -->
  <input />

  <!--
    The <llm:score> tag is one of many AI-based tags that lets you drive your story.
    It creates a data set with each attribute scored according to its value.
    The `key` tag determines what variable the data gets stored in.
  -->
  <llm:score
    key="choice"
    woods="the player chooses the woods"
    swamp="the player chooses the swamp">
    The player has a choice between visiting the woods and the swamp. Based on their input, which do they choose?
    {{input}}
  </llm:score>

  <if cond="choice.woods > choice.swamp">
    <p voice="narrator">
      You make your way down the path into the darkening forest.
    </p>
    <jump to="woods" />
  </if>

  <p voice="narrator">
    You trudge toward the misty swamp ahead.
  </p>
  <jump to="swamp" />
</origin>

<!--
  The <macro> tag lets you transform tags in your story to make authoring easier.
  Instead of writing `<p voice="narrator">` over and over, this macro lets us use `<narrator>` anywhere in the story.
-->
<macro match="narrator">
  <rename to="p" />
  <set attr="voice" value="narrator" />
</macro>

<!--
  <div> tags are just containers for content. Container tags are in the order they are written.
  You can also
-->
<div id="woods">
  <narrator>
    As your eyes adjust to the dark, you look around at the trees.
  </narrator>

  <narrator>
    <!-- With the {% %} template pattern, you can use a prompt for generative AI to create story content. -->
    You see {% short, suspenseful description of a dark forest in present tense %}.
  </narrator>

  <!--
    The <checkpoint> tag indicates a point to which the player may rewind the story.
    Every visit to an <input> also creates a checkpoint, but you can use <checkpoint> to explicitly create one.
  -->
  <checkpoint />

  <narrator>
    From somewhere within the thicket of trees, you hear a strange voice.
  </narrator>

  <!-- The <wretch> tag is defined by the macro at the top of this file -->
  <wretch>
    Who goes there...?
  </wretch>

  <narrator>
    Upon hearing this voice, you freeze in your tracks. You can't see where the voice came from.
  </narrator>

  <wretch>
    I be the keeper of these woods.
    I eat all who tresspass, starting with theys toes.
    Only thems who answer me riddle may pass.
  </wretch>

  <!--
    The <llm:generate> tag can be used to generate content using AI from a prompt.
    Here we also use {$ $} template pattern syntax for inline JavaScript fragments.
  -->
  <llm:generate
    key="riddle"
    question="the full riddle question"
    answer="answer to the riddle">
    Create a short riddle that works in a medieval British fantasy setting.
    Give your response in two parts: the question, and the answer.
    The answer should be a single word related to {$ randElement(["summer", "winter", "autumn", "spring"]) $}.
    The question should be short and lyrical, with grammar like Gollum.
  </llm:generate>

  <wretch>
    Answer me this:  
    {{riddle.question}}
  </wretch>

  <narrator>
    How do you answer the riddle?
  </narrator>

  <!-- Input can be stored under any state variable you choose, using the `key` tag. -->
  <input key="reply" />

  <!--
    With the <script> tag you can use JavaScript to write programmatic logic.
    By default, all state variables are available in the scope of this script.
    To set a state variable (i.e. to be available after the script runs), use the `set(key, value)` function.
  -->
  <script>
    set("riddleSolved", reply.includes(riddle.answer))
  </script>

  <if cond="riddleSolved">
    <!-- Single-bracket syntax can be used to add emotional inflection to the generated speech -->
    <wretch>
      Ye solved me riddle, [reluctantly] so I'll let ye pass.
      [forcefully] Come not again to these woods, traveler.
    </wretch>
    <narrator>
      With your life (and toes) intact, you continue through the forest.
      Eventually the woods thin and you find yourself in an open field.
    </narrator>

    <!-- An <else> block can be placed inside of an <if> tag for more complex conditional support. --->
    <else>
      <wretch>
        Ye answer was wrong. Which makes me happy, as I've not had a meal in days.
        Hee hee hee, don't even try to run away...
      </wretch>
      <narrator>
        Before you know it, you find yourself in the clutches of this strange creature.
        Giggling, it begins taking off your shoes.
      </narrator>
      <!-- The <sound> tag generates or plays sound effects. -->
      <sound duration="5000">
        Grotesque sound of a mouth chewing and gnawing on meat and gristle
      </sound>
      <jump to="dead" />
    </else>
  </if>

  <!-- The <jump> tag navigates to another section by its id. -->
  <jump to="outpost" />
</div>

<div id="swamp">
  <!-- The <data> tag loads structured data (JSON or YAML) and stores it in a state variable. -->
  <data key="unrhymable" format="yaml">
    - orange
    - silver
    - purple
    - month
    - ninth
    - pint
    - wolf
    - opus
    - dangerous
    - marathon
    - discombobulate
    - rhythm
  </data>

  <narrator>
    You wade into a murky swamp.
    The water reaches your knees, and something moves in the fog ahead.
    Soon, a large, slimy creature emerges from the muck.
  </narrator>

  <!-- The <rhymer> tag is defined by the macro at the top of this file -->
  <rhymer>
    Speak a word, and I'll reply in rhyme.
    I'll keep you here till the end of time.
  </rhymer>

  <narrator>
    You try to pass the creature, but it blocks your way.
    Perhaps something you say will cause it to let you pass.
  </narrator>

  <!-- The <var> tag declares or updates a state variable with a name, value, and optional type. -->
  <var name="rhymeTurns" value="0" type="number" />

  <!-- The <while> tag creates a loop that continues while its condition is true. -->
  <while cond="rhymeTurns < 10">
    <input />
    
    <llm:parse
      key="playerWord"
      lastWord="the last word the player said">
      {{input}}
    </llm:parse>

    <!-- Use <script> to check if the player said an unrhymable word and increment the turn counter. -->
    <script>
      const word = playerWord.lastWord?.toLowerCase() || "";
      const isUnrhymable = unrhymable.some(w => word.includes(w));
      set("stumped", isUnrhymable);
      set("rhymeTurns", rhymeTurns + 1);
    </script>

    <if cond="stumped">
      <rhymer>
        [confused] {{playerWord.lastWord}}? But that word... I cannot...
        My rhyming power, I have forgot!
      </rhymer>
      <narrator>
        The creature stumbles backward, thoroughly befuddled.
        You quickly wade past while it mutters to itself.
        Eventually the swamp ends and you find yourself in an open field.
      </narrator>
      <!-- The <break> tag exits the current loop immediately. -->
      <break />
    </if>
    <else>
      <rhymer>
        {% Create a short rhyming response to "{{playerWord.lastWord}}" that blocks the path %}
      </rhymer>
      <if cond="rhymeTurns >= 5">
        <narrator>
          Perhaps you should try a word that's harder to rhyme...
        </narrator>
      </if>
    </else>
  </while>

  <jump to="outpost" />
</div>

<div id="outpost">
  <!-- Initialize player's inventory from external data file -->
  <script>
    set("gold", player.starting_gold);
    set("inventory", player.starting_inventory);
  </script>

  <narrator>
    There is a stone outpost here with a small wooden door. You push it open and find a merchant inside.
  </narrator>

  <!-- The <merchant> tag is defined by the macro at the top of this file -->
  <merchant>
    [enthusiastically] Ah, a customer! Welcome, welcome! I have many fine wares for sale!
  </merchant>

  <!-- Define reusable transaction blocks -->
  <block id="buy-item">
    <if cond="gold >= price">
      <merchant>
        Excellent choice! The {{item}} is yours for {{price}} gold.
      </merchant>
      <script>
        // Write to session state to persist beyond block scope
        ctx.session.state.gold = gold - price;
        ctx.session.state.inventory = [...inventory, item];
      </script>
      <narrator>
        You purchase the {{item}}. You now have {{gold}} gold remaining.
      </narrator>
    </if>
    <else>
      <merchant>
        [apologetically] Ah, but you need {{price}} gold for the {{item}}. You only have {{gold}}.
      </merchant>
    </else>
  </block>

  <block id="sell-item">
    <script>
      const hasItem = inventory.includes(item);
      set("hasItem", hasItem);
    </script>
    <if cond="hasItem">
      <merchant>
        I'll give you {{price}} gold for your {{item}}.
      </merchant>
      <script>
        // Write to session state to persist beyond block scope
        ctx.session.state.gold = gold + price;
        ctx.session.state.inventory = inventory.filter(i => i !== item);
      </script>
      <narrator>
        You sell the {{item}}. You now have {{gold}} gold.
      </narrator>
    </if>
    <else>
      <merchant>
        [confused] But you don't have a {{item}} to sell me!
      </merchant>
    </else>
  </block>

  <merchant>
    I buy and sell items: {$ Object.entries(shop).map(([name, price]) => `${name} for ${price} gold`).join(', ') $}.
    What catches your eye?
  </merchant>

  <narrator>
    You have {{gold}} gold. Your inventory contains {$ inventory.join(', ') $}.
    What would you like to do?
  </narrator>

  <var name="merchantDone" value="false" type="boolean" />

  <while cond="!merchantDone">
    <input />

    <!-- Use the <llm:tag> tag to classify the player's intent -->
    <llm:tag
      key="intent"
      buy_potion="wants to buy a potion"
      buy_compass="wants to buy a compass"
      buy_sword="wants to buy a sword"
      sell_potion="wants to sell a potion"
      sell_compass="wants to sell a compass"
      sell_sword="wants to sell a sword"
      leave="wants to leave or is done shopping">
      {{input}}
    </llm:tag>

    <if cond="intent.includes('buy_potion')">
      <yield to="buy-item" item="potion" price="{$ shop.potion $}" />
    </if>
    
    <if cond="intent.includes('buy_compass')">
      <yield to="buy-item" item="compass" price="{$ shop.compass $}" />
    </if>

    <if cond="intent.includes('buy_sword')">
      <yield to="buy-item" item="sword" price="{$ shop.sword $}" />
    </if>

    <if cond="intent.includes('sell_potion')">
      <yield to="sell-item" item="potion" price="{$ shop.potion $}" />
    </if>

    <if cond="intent.includes('sell_compass')">
      <yield to="sell-item" item="compass" price="{$ shop.compass $}" />
    </if>

    <if cond="intent.includes('sell_sword')">
      <yield to="sell-item" item="sword" price="{$ shop.sword $}" />
    </if>

    <if cond="intent.includes('leave') || intent.length === 0">
      <merchant>
        [cheerfully] Come back anytime, friend! Safe travels!
      </merchant>
      <var name="merchantDone" value="true" type="boolean" />
    </if>
    <else>
      <if cond="!intent.includes('buy') && !intent.includes('sell')">
        <narrator>
          Anything else? You can buy items, sell items, or leave.
        </narrator>
      </if>
    </else>
  </while>

  <narrator>
    You leave the outpost and continue on your journey.
  </narrator>
  
  <jump to="troll" />
</div>

<div id="troll">
  <narrator>
    After a long walk, you come across an impassable river.
    Over the river spans a rickety wooden bridge.
    A large troll crawls out from beneath and blocks your way.
  </narrator>

  <troll>
    I shan't let ye cross me bridge unless ye pay me toll.
    What have ye to pay with?
  </troll>

  <!--
    With <include> you can pull in separately defined content by referencing its `id` attribute.
    In this case, we're referencing the content inside <module id="troll"> to be included here.
  -->
  <include id="troll" />
</div>

<!--
  There's nothing special about the <module> tag - by default, it will be ignored, so we can use
  it as a container for content that we can reference using <include>. You could keep this here
  or put it into a different file.
-->
<module id="troll">
  <var name="trollSatisfied" type="boolean" value="false" />
  <var name="offeredItem" value="" />
  <var name="attempts" type="number" value="0" />

  <narrator>
    You have {$ inventory.join(', ') $} and {{gold}} gold coins.
    Can you convince the troll to let you pass?
  </narrator>

  <while cond="!trollSatisfied">
    <input />

    <var name="attempts" value="{$ attempts + 1 $}" />

    <if cond="attempts > 5">
      <narrator>
        Perhaps it's not just what you offer, but how well you argue its value that matters to the troll.
      </narrator>
    </if>

    <llm:line
      key="trollResponse"
      as="troll">
      You are a bridge troll who demands payment to cross.
      Just being offered an item or gold for payment isn't enough - you need to be convinced of its value.
      <when cond="!offeredItem">
        The traveler hasn't offered anything yet. Be impatient and demanding.
      </when>
      <when cond="offeredItem">
        The traveler offered {{offeredItem}}. Consider their argument about its value.
        If they make a good case about why {{offeredItem}} is valuable, let them pass.
      </when>
    </llm:line>

    <troll>{{trollResponse}}</troll>

    <llm:parse
      key="analysis"
      offered="what item the player offered (bread, sword, potion, gold, or null)"
      convinced="whether the troll was convinced by the player's argument">
      The player is trying to convince the troll to let them pass the bridge.
      The troll will only let them cross if convinced by the player's persuasion.
      The player said: {{input}}
      The troll said: {{trollResponse}}
      Now assess whether the troll was convinced by what was offered.
    </llm:parse>

    <script>
      if (analysis.offered && !offeredItem) {
        set("offeredItem", analysis.offered);
      }
      if (analysis.convinced) {
        set("trollSatisfied", true);
      }
    </script>
  </while>

  <troll>
    <when cond="offeredItem">
      I'll take ye {{offeredItem}}, then.
    </when>
    <when cond="!offeredItem">
      Ye've convinced me with yer words alone.
    </when>
  </troll>

  <narrator>
    The troll steps aside, grumbling but satisfied with the trade.
  </narrator>

  <jump to="win" />
</module>

<div id="dead">
  <narrator>
    Unfortunately, you have perished.
    Another adventurer will have to take up your quest.
  </narrator>

  <!--
    The <end> tag ends the story and causes the game to exit.
    If an <outro> is present, it will also be played before the game exits.
  -->
  <end />
</div>

<div id="win">
  <narrator>
    Having survived multiple perils, you look out at the horizon with optimism.
    You forge ahead, ready to continue your adventure.
    The end.
  </narrator>
  <end />
</div>

<!-- The <outro> tag plays once at the end of the story, after all other story content has been finished. -->
<outro>
  <p>
    Thank you for playing {{title}}, by {{author}}.
    We hope you've enjoyed your adventure.
  </p>
</outro>

```
*/