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

WSL supports many other tags and syntactical expressions including loops, function-like blocks, scope, conditional text occlusion, a number of LLM-powered tags - even macros. A sandboxed JavaScript environment is provided for scripting. For a list of all tags and structures, see the Welltale Story Language Reference.

## Vision

Stories can be short or endless, linear or branching, purely human-written or partially AI-generated. WSL makes it easy to combine authored structure with AI creativity — generating dialogue, voices, music, and even story content on the fly. _The only limit... is your imagination!™_

~~~~~
Supported XML tags:
~~~~~
Tag: <p> (<text>, <#text>, <span>, <b>, <strong>, <em>, <i>, <h1>, <h2>, <h3>, <h4>, <h5>, <h6>, <output>)
Desc: Text content elements contain narration, dialogue - any content that gets played as spoken audio to the player. (Note: A set of HTML text tags is included just for convenience, so Welltale is able to interpret even regular webpages as stories.)
This content is rendered into audio clips automatically by Welltale using text-to-speech, and then played on the story client to the player.
The `name` attribute can be used to indicate the person speaking. If none given, `"HOST"` is used.
The `voice` attribute can assign a specific text-to-speech voice to the speech. If none is given, the default voice (the one used for \"HOST\") is used. Voices are defined in data files (data.yml or data.json) in your story directory.
Warning: The only tag you can place inside of a text content element is `<when>`. See the docs on `<when>` for adding expressive conditional logic to your text elements.
Attrs: {"name":{"type":"string","desc":"Speaker/character name","req":false,"default":"HOST"},"voice":{"type":"string","desc":"Voice ID for text-to-speech generation","req":false},"to":{"type":"string","desc":"Comma-separated list of recipients who hear this","req":false,"default":"PLAYER"},"obs":{"type":"string","desc":"Comma-separated list of observers who witness but don't hear directly","req":false},"tags":{"type":"string","desc":"Comma-separated tags affecting speech generation","req":false},"volume":{"type":"number","desc":"Volume level from 0.0 to 1.0","req":false},"background":{"type":"boolean","desc":"Play narration in background without blocking","req":false,"default":"false"},"fadeAt":{"type":"number","desc":"Start fading at this time in milliseconds","req":false},"fadeDuration":{"type":"number","desc":"Duration of fade in milliseconds","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <input> (<textarea>)
Desc: Pauses story execution to get input from the user.
If the input can't be validated from attributes alone, AI will automatically be used to parse and validate the input.
Raw input is stored in the `input` state variable. Extracted fields are stored under the `_` state variable, or the variable given by the `key` attribute if present.
Note: Every `<input>` automatically create a story checkpoint.
Attrs: {"id":{"type":"string","desc":"Unique identifier for this input point","req":false},"scope":{"type":"string","desc":"Set to 'global' to store extracted values in global state","req":false,"default":"local"},"[field].description":{"type":"string","desc":"Description for AI to extract this field from input","req":false},"[field].type":{"type":"string","desc":"Expected type: string, number, boolean","req":false,"default":"string"},"[field].default":{"type":"string","desc":"Default value if field not found in input","req":false}}

Tag: <var>
Desc: Defines or updates a variable in the current scope. Variables can hold any type of data and can be used in template expressions like `{{variableName}}`.
Attrs: {"name":{"type":"string","desc":"Variable name (aliases: key, id)","req":true},"value":{"type":"string","desc":"Value to assign. If omitted, uses element's inner content.","req":false},"type":{"type":"string","desc":"Type to cast value to: string, number, boolean, array, object, date","req":false,"default":"string"}}

Tag: <if>
Desc: Conditional execution of story content. Evaluates the JavaScript expression in the `cond` attribute and executes child elements only if the condition is true.
Note: `<else>` blocks are *not* supported currently.
Attrs: {"cond":{"type":"string","desc":"JavaScript expression to evaluate. Has access to all scope variables.","req":true}}

Tag: <jump>
Desc: Navigates to another section of the story by ID. Can be conditional using the 'if' attribute.
The target must be an element with an id attribute (typically `<div>` elements, but can be any type of element).
This is the primary way to implement branching narratives and story choices.
Attrs: {"to":{"type":"string","desc":"ID of the target element to jump to (aliases: target, destination)","req":true},"if":{"type":"string","desc":"JavaScript condition that must be true for the jump to execute","req":false}}

Tag: <script> (<code>)
Desc: Executes JavaScript. All defined state variables, story metadata, and session information are provided in the script's scope automatically.
State variables you wish to mutate and persist after the script block exits can be done using `wsl.set(key, value)`.
Please also see the scripting API reference for a variety of other built-in utility functions available.
Code runs in a sandboxed environment.
Attrs: {}

Tag: <sleep>
Desc: Pauses story execution for a specified duration. Useful for dramatic timing, letting audio play, or creating rhythm in the narrative. The duration is in milliseconds.
Note: During sleep, audio marked as "background" will continue playing.
Attrs: {"duration":{"type":"number","desc":"Pause duration in milliseconds (aliases: for, ms)","req":false,"default":"1"}}

Tag: <while> (<loop>)
Desc: Repeats child elements while a Javascript condition in its `cond` attribute remains true.
The condition is evaluated before each iteration. Supports `<break />` and `<continue />` statements for loop control.
Attrs: {"cond":{"type":"string","desc":"JavaScript expression evaluated before each iteration. May be omitted and you can use <break /> to exit the loop","req":false}}

Tag: <sound> (<audio>, <music>)
Desc: Plays audio content in the story.
If a `url` attribute is given, it is played directly.
Otherwise the prompt (inner text content) is used, and the chosen tag determines the type:
- `<sound>` or `<audio>`: Sound effects
- `<music>`: Music clip
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attributes can used for volume control, fading, etc.
Attrs: {"src":{"type":"string","desc":"URL of audio file to play (aliases: href, url)","req":false},"duration":{"type":"number","desc":"Duration in milliseconds for AI-generated audio","req":false,"default":"5000 for sound, 10000 for music"},"prompt":{"type":"string","desc":"Description for AI audio generation (aliases: make, description)","req":false},"background":{"type":"boolean","desc":"Play audio in background without blocking story flow","req":false,"default":"false"},"volume":{"type":"number","desc":"Volume level from 0.0 to 1.0","req":false,"default":"1.0"},"fadeAt":{"type":"number","desc":"Start fading at this time in milliseconds","req":false},"fadeDuration":{"type":"number","desc":"Duration of fade in milliseconds","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <div> (<root>, <html>, <body>, <ul>, <ol>, <li>, <section>, <sec>, <pre>, <origin>, <main>, <aside>, <article>, <details>, <summary>)
Desc: `<div>` and many other logicless container elements are available to structure your story content.
All container tags are synonymous and have no function other than grouping.
Various HTML tags are included to allow Welltale to play HTML pages as well.
These container tags can contain any other tags to arbitrary depth.
These tags organize the narrative into logical sections and can contain other tags.
Attrs: {"id":{"type":"string","desc":"Unique identifier for navigation and jumping","req":false}}

Tag: <llm:text>
Desc: Generates unstructured text content using AI based on a prompt. This is useful for creating narrative content, descriptions, dialogue, or any text that doesn't need to be parsed into structured data.
The generated text is stored as a simple string.
The output of this tag is stored in variable given by the `key` attribute if present, else the `_` variable.
Attrs: {"key":{"type":"string","desc":"Variable name to store the generated text (default: 'text')","req":false,"default":"text"},"web":{"type":"boolean","desc":"Enable web search for current information during generation","req":false,"default":"false"},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <llm:tag>
Desc: Classifies input text into predefined categories using AI.
The tag analyzes the text content and returns an array of matching labels based on their descriptions.
Each attribute becomes a potential label with its value serving as the description for classification.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
The AI returns only the labels that match the content, supporting multiple label assignment.
Attrs: {"key":{"type":"string","desc":"Variable name to store the array of matching labels (default: 'tags')","req":false,"default":"tags"},"web":{"type":"boolean","desc":"Enable web search for current information during classification","req":false,"default":"false"},"[label]":{"type":"string","desc":"Label name as attribute, description as value. AI returns labels that match.","req":false}}

Tag: <llm:score>
Desc: Scores text content on multiple dimensions using AI.
Each attribute becomes a scoring dimension, and the AI returns a numeric score between `0.0` and `1.0` for each dimension.
This is useful for sentiment analysis, content moderation, or any scenario requiring quantitative text evaluation.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attrs: {"key":{"type":"string","desc":"Variable name to store the scores object (default: 'score')","req":false,"default":"score"},"web":{"type":"boolean","desc":"Enable web search for fact-checking during scoring","req":false,"default":"false"},"[dimension]":{"type":"string","desc":"Scoring dimension name as attribute, description as value. Returns 0.0-1.0 score.","req":false}}

Tag: <llm:moderate>
Desc: Evaluates text against safety categories and returns scores plus a flagged status.
Provide an input body and optionally adjust the moderation threshold.
A flagged result becomes true when any category score exceeds the threshold.
Attrs: {"key":{"type":"string","desc":"Variable name to store moderation result (default: 'moderation')","req":false,"default":"moderation"},"threshold":{"type":"number","desc":"Flag when any category score is above this value","req":false,"default":"0.5"},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false}}

Tag: <llm:parse>
Desc: Extracts structured data from text content using AI.
The tag analyzes the inner text and extracts values according to a schema defined by the attributes.
Each attribute becomes a field in the extracted data, with optional type and description properties specified using dot notation.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attrs: {"key":{"type":"string","desc":"Variable name to store the extracted data (default: 'parse')","req":false,"default":"parse"},"web":{"type":"boolean","desc":"Enable web search as the AI extracts the data","req":false,"default":"false"},"[field]":{"type":"string","desc":"Simple field: attribute name becomes field name, value becomes description","req":false},"[field].type":{"type":"string","desc":"Field type: string, number, boolean, array<string>, etc.","req":false,"default":"string"},"[field].description":{"type":"string","desc":"Detailed description of what to extract for this field","req":false},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <llm:generate>
Desc: Generates structured content using AI based on instructions and a schema.
Unlike `<llm:parse>` which extracts data from existing text, this tag creates new content according to specifications. Supports complex nested structures and various data types.
The output of this tag is stored in the `_` state variable, or the variable given by the `key` attribute if present.
Attrs: {"key":{"type":"string","desc":"Variable name to store the generated data (default: 'generate')","req":false,"default":"generate"},"web":{"type":"boolean","desc":"Enable web search for current information during generation","req":false,"default":"false"},"[field]":{"type":"string","desc":"Simple field: attribute name becomes field name, value becomes description","req":false},"[field].type":{"type":"string","desc":"Field type: string, number, boolean, array<string>, etc.","req":false,"default":"string"},"[field].description":{"type":"string","desc":"Detailed description of what to generate for this field","req":false},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <llm:line>
Desc: Generates a single NPC response using recent conversation history.
The internals of this tag are somewhat complext to support the use case of conversation. It gathers relevant dialog between the NPC and listed participants, then prompts an LLM to produce the next line without a speaker prefix.
In order for this tag to work, you *must* tag your story's input and output tags (e.g. &lt;input&gt; and &lt;p&gt;) with the appropriate `from` attribute indicating who spoke, and that must align with this tag's `as` and `with` attributes.
The `as` attribute is the NPC who is replying, whereas the `with` with is a comma-delimited list of others with whom that NPC is talking. Think of them as "people in the room."
If you want to implement a dialog part of your story with off-the-shelf, transparent conversation history, use this tag.
Attrs: {"as":{"type":"string","desc":"Name of the speaker generating this line","req":true},"with":{"type":"string","desc":"Comma-separated list of other participants to include in history","req":false},"key":{"type":"string","desc":"Variable name to store the generated line (default: 'line')","req":false,"default":"line"},"limit":{"type":"number","desc":"Maximum number of recent dialog lines to include (default: 12)","req":false},"web":{"type":"boolean","desc":"Enable web search during generation","req":false,"default":"false"},"models":{"type":"string","desc":"Comma-separated list of model slugs to use","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <block>
Desc: Defines a reusable content block that can be invoked with `<yield>`.
Blocks are skipped during normal story flow and only execute when explicitly yielded to.
They can receive parameters from the `<yield>` tag, making them similar to functions in programming.
Attrs: {"id":{"type":"string","desc":"Unique identifier for the block, used by yield tags to invoke it","req":true}}

Tag: <yield>
Desc: Invokes a defined `<block>` with optional parameters.
Acts like a function call, jumping to the block's content with the provided parameters available as variables.
After the block completes, execution returns to the point after the `<yield>` tag — or to a specified return point specified by the `returnTo` attribute.
For examples, see the documentation for `<block>`.
Attrs: {"to":{"type":"string","desc":"ID of the block to yield to (alias: target)","req":true},"return":{"type":"string","desc":"ID of element to jump to after block completes (alias: returnTo)","req":false},"[param]":{"type":"string","desc":"Parameters passed to the block as variables","req":false}}

Tag: <scope>
Desc: Creates a new state variable scope for child elements.
By default, state variables are global, but this lets you isolate them wherever you need to avoid polluting the global namespace.
State variables defined within the scope are isolated and don't affect the parent scope.
Attrs: {}

Tag: <macro>
Desc: Macros allow you to create shorthand notation that expands into full story elements.
They're processed at runtime and applied to matching patterns throughout the story content.
Attrs: {"match":{"type":"string","desc":"Tag name pattern to match for macro expansion","req":true}}

Tag: <include>
Desc: When the compiler sees an `<include>` tag, it replaces it with the content within the node that has the given `id` attribute.
Attrs: {"id":{"type":"string","desc":"ID of the element to include","req":true}}

Tag: <when>
Desc: The `<when>` tag is a special tag used to conditionally render text content.
Unlike the runtime `<if>` tag, which controls story flow, `<when>` operates only when text is being prepared to render.
It cannot be used outside of text content tags.
It is useful when you want to provide an LLM prompt but want to omit content until conditions are met.
Attrs: {"cond":{"type":"string","desc":"JavaScript expression to evaluate for content inclusion","req":true}}

Tag: <data>
Desc: Loads structured data from JSON or YAML format, either from the tag's content or from a URL.
Useful for loading configuration, game data, or any structured information.
The data is stored in the state variable given by the `key` attribute.
Attrs: {"key":{"type":"string","desc":"Variable name to store the loaded data","req":false,"default":"data"},"src":{"type":"string","desc":"URL to load data from (aliases: href, url)","req":false},"format":{"type":"string","desc":"Data format: json or yaml/yml. Auto-detected from content-type if loading from URL.","req":false,"default":"json"},"method":{"type":"string","desc":"HTTP method when loading from URL","req":false,"default":"GET"}}

Tag: <checkpoint>
Desc: Creates a save point in the story that users can resume from.
Checkpoints store the current state, variables, and conversation history.
Note: Checkpoits will already be automatically created at section boundaries and before input prompts by the Welltale engine, but using this tag they can also be manually placed for important story moments.
Attrs: {}

Tag: <intro>
Desc: Defines content that plays at the start of a story or when starting fresh.
This tag typically contains introductory narration, music, or scene-setting.
Note: This content is skipped when resuming a saved story. Only one intro section should exist per story.
Attrs: {}

Tag: <outro>
Desc: Defines content that plays when a story ends. Can contain credits, final narration, or closing music.
The outro is triggered by the story engine when reaching a story endpoint.
Attrs: {}

Tag: <resume>
Desc: Defines content that only plays when resuming a saved story.
Useful for recaps, reminders, or re-establishing context.
This content is skipped during normal story flow and only executes when a user returns to a saved checkpoint.
Attrs: {}

Tag: <end>
Desc: Immediately ends the story.
If an `<outro>` block exists, it will be played before ending.
This tag provides explicit story termination points for branching narratives.
Attrs: {}

Tag: <exit>
Desc: Immediately exits the story without playing any outro.
Use this for abrupt endings or  when you want to skip the outro entirely.
Compare with `<end />` which plays the outro if present.
Attrs: {}

Tag: <read>
Desc: Reads and narrates text content from a URL or inline content.
Attrs: {"src":{"type":"string","desc":"URL to fetch text content from (aliases: href, url)","req":false},"from":{"type":"string","desc":"Speaker/character reading the text (aliases: speaker, label)","req":false,"default":"HOST"},"voice":{"type":"string","desc":"Voice ID to use for narration","req":false},"to":{"type":"string","desc":"Comma-separated list of recipients","req":false,"default":"PLAYER"},"tags":{"type":"string","desc":"Comma-separated tags for the narration","req":false},"volume":{"type":"number","desc":"Volume level from 0.0 to 1.0","req":false},"background":{"type":"boolean","desc":"Play narration in background","req":false,"default":"false"},"fadeAt":{"type":"number","desc":"Start fading at this time in milliseconds","req":false},"fadeDuration":{"type":"number","desc":"Duration of fade in milliseconds","req":false},"seed":{"type":"string","desc":"Seed for deterministic generation (provider-specific usage)","req":false}}

Tag: <log>
Desc: Outputs debug information to the console.
Useful for story development and debugging.
Can display messages, variable values, or dump the entire current state.
Attrs: {"message":{"type":"string","desc":"Message to log. If omitted, uses inner content.","req":false},"dump":{"type":"boolean","desc":"Dump full context including attributes, session, options, and scope","req":false,"default":"false"}}
~~~~~
JavaScript environment built-in utility functions:
~~~~~
wsl.blank('') //=> true Returns true/false if the given value is blank: empty string, empty array, empty object, zero, null, or undefined
wsl.toBoolean('true') //=> true Converts the given value to a boolean
wsl.toNumber('42') //=> 42 Converts the given value to a number
wsl.toString(42) //=> '42' Converts the given value to a string
wsl.compact([1,0,2,null,3]) // => [1,2,3] Returns the array with falsy values removed
wsl.contains([1,2,3], 2) // => true Returns true if the array contains the value
wsl.count([1,2,2,3], 2) // => 2 Returns the number of times the value appears in the array
wsl.difference([1,2,3], [2,3,4]) // => [1] Returns elements in the first array that are not in the second
wsl.drop([1,2,3,4], 2) // => [3,4] Returns the array with the first n elements removed
wsl.first([1,2,3]) // => 1 Returns the first element of the array, else null
wsl.flatten([1,[2,3],4]) // => [1,2,3,4] Returns the array flattened one level deep
wsl.flattenDeep([1,[2,[3]]], 2) // => [1,2,3] Returns the array flattened to the specified depth
wsl.intersection([1,2,3], [2,3,4]) // => [2,3] Returns the intersection of two arrays
wsl.last([1,2,3]) // => 3 Returns the last element of the array, else null
wsl.mean([1,2,3]) // => 2 Returns the arithmetic mean of all numeric values in the array
wsl.median([1,2,3]) // => 2 Returns the median value of the array
wsl.nth([1,2,3], 1) // => 2 Returns the nth element of the array, else null
wsl.sortDesc([3,1,2]) // => [3,2,1] Returns the array sorted in descending order
wsl.sum([1,2,3]) // => 6 Returns the sum of all numeric values in the array
wsl.sumBy([[1,2],[3,4]], 1) // => 6 Returns the sum of values at the specified index or property
wsl.take([1,2,3,4], 2) // => [1,2] Returns the first n elements of the array
wsl.union([1,2], [2,3]) // => [1,2,3] Returns the union of two arrays with duplicates removed
wsl.uniq([1,2,2,3]) // => [1,2,3] Returns the array with duplicate values removed
wsl.camelCase("hello-world") //=> "helloWorld" Returns camelCase form of the given string
wsl.capitalize("bear") //=> "Bear" Returns capitalized form of the given string
wsl.kebabCase("helloWorld") //=> "hello-world" Returns kebab-case form of the given string
wsl.listize(["a", "b", "c"]) //=> "a, b and c" Converts array to natural language list
wsl.ordinalize(21) //=> "21st" Returns ordinal form of number
wsl.pluralize("cat", 2) //=> "cats" Returns plural form of word based on count
wsl.snakeCase("helloWorld") //=> "hello_world" Returns snake_case form of the given string
wsl.titleCase("hello world") //=> "Hello World" Returns title case form of the given string
wsl.uncapitalize("Bear") //=> "bear" Returns uncapitalized form of the given string
wsl.approach(5, 10, 2) // => 7 Moves a value toward a target by a fixed step
wsl.average(1, 2, 3, 4) // => 2.5 Returns the average of the given numbers
wsl.avg(1, 2, 3, 4) // => 2.5 Returns the average of the given numbers
wsl.ceilTo(3.14159, 2) // => 3.15 Ceils a number to the specified precision
wsl.clamp(13, 0, 10) // => 10 Returns number clamped within the given min, max range
wsl.decay(100, 0.1, 1) // => 90 Applies exponential decay to a value
wsl.decayToward(100, 50, 0.1, 1) // => 95 Applies exponential decay toward a target value
wsl.decr(5, 2) // => 3 Decrements a number by the specified amount
wsl.degToRad(180) // => 3.14159 Converts degrees to radians
wsl.denormalize(0.5, 0, 10) // => 5 Converts a normalized value back to the original range
wsl.distance(0, 0, 3, 4) // => 5 Returns the Euclidean distance between two points
wsl.factorial(5) // => 120 Returns the factorial of a number
wsl.floorTo(3.14159, 2) // => 3.14 Floors a number to the specified precision
wsl.fract(3.14) // => 0.14 Returns the fractional part of a number
wsl.gcd(12, 8) // => 4 Returns the greatest common divisor of two numbers
wsl.incr(5, 2) // => 7 Increments a number by the specified amount
wsl.inverseLerp(0, 10, 5) // => 0.5 Returns the interpolation factor for a value between two bounds
wsl.isPrime(7) // => true Returns true if the number is prime
wsl.lcm(4, 6) // => 12 Returns the least common multiple of two numbers
wsl.lerp(0, 10, 0.5) // => 5 Linear interpolation between two values
wsl.manhattan(0, 0, 3, 4) // => 7 Returns the Manhattan distance between two points
wsl.map(5, 0, 10, 0, 100) // => 50 Maps a value from one range to another
wsl.moveToward(5, 10, 2) // => 7 Moves a value toward a target with maximum delta
wsl.nCr(5, 2) // => 10 Returns the number of combinations (n choose r)
wsl.normalize(5, 0, 10) // => 0.5 Normalizes a value to a 0-1 range
wsl.nPr(5, 2) // => 20 Returns the number of permutations (n permute r)
wsl.oscSawtooth(0.5, 1, 2) // => 0 Generates a sawtooth wave oscillation
wsl.oscSine(0.25, 1, 2) // => 2 Generates a sine wave oscillation
wsl.oscSquare(0.25, 1, 2) // => 2 Generates a square wave oscillation
wsl.oscTriangle(0.5, 1, 2) // => -2 Generates a triangle wave oscillation
wsl.pingPong(3, 2) // => 1 Creates a ping-pong pattern that bounces between 0 and length
wsl.quantize(7.3, 2) // => 8 Quantizes a value to the nearest step increment
wsl.radToDeg(3.14159) // => 180 Converts radians to degrees
wsl.repeat(3.5, 2) // => 1.5 Repeats a value within the specified length
wsl.roundTo(3.14159, 2) // => 3.14 Rounds a number to the specified precision
wsl.smoothstep(0, 1, 0.5) // => 0.5 Smooth interpolation with ease-in-out curve
wsl.standardDeviation(1, 2, 3, 4, 5) // => 1.414 Returns the standard deviation of the given numbers
wsl.stdDev(1, 2, 3, 4, 5) // => 1.414 Returns the standard deviation of the given numbers
wsl.step(5, 3) // => 0 Returns 0 if x < edge, otherwise 1
wsl.variance(1, 2, 3, 4, 5) // => 2 Returns the variance of the given numbers
wsl.wrap(12, 0, 10) // => 2 Wraps a value within the specified range
wsl.day(1735689600000) // => 1 Gets the day of month from a timestamp
wsl.daysSince(1735603200000) // => 1 Calculates days since a past timestamp
wsl.daysUntil(1735689600000) // => 5 Calculates days until a target timestamp
wsl.decimalHoursToClock(2.5) // => '2:30' Converts decimal hours to clock format
wsl.hour(1735732800000) // => 12 Gets the hour (0-23) from a timestamp
wsl.hoursSince(1735689600000) // => 12 Calculates hours since a past timestamp
wsl.hoursUntil(1735732800000) // => 24 Calculates hours until a target timestamp
wsl.minute(1735734600000) // => 30 Gets the minute (0-59) from a timestamp
wsl.minutesSince(1735732800000) // => 30 Calculates minutes since a past timestamp
wsl.minutesUntil(1735734600000) // => 30 Calculates minutes until a target timestamp
wsl.month(1735689600000) // => 1 Gets the month (1-12) from a timestamp
wsl.monthName(1735689600000) // => 'January' Gets the month name from a timestamp
wsl.msToDecimalHours(3600000) // => 1 Converts milliseconds to decimal hours
wsl.now() // => 1762071908493 Returns current Unix timestamp in milliseconds
wsl.second(1735734645000) // => 45 Gets the second (0-59) from a timestamp
wsl.timestamp(2024, 12, 25, 10, 30) // => 1735119000000 Creates a timestamp from date components (UTC)
wsl.weekday(1735689600000) // => 3 Gets the weekday (0=Sunday, 6=Saturday) from a timestamp
wsl.weekdayName(1735689600000) // => 'Wednesday' Gets the weekday name from a timestamp
wsl.year(1735689600000) // => 2025 Gets the year from a timestamp
wsl.coinToss(0.7) //=> true Returns true/false based on probability (default 0.5)
wsl.dice(20) //=> 15 Rolls a die with specified number of sides (default 6)
wsl.randAlphaNum(8) //=> 'A7b9X2m1' Returns a random alphanumeric string of specified length
wsl.randElement([1, 2, 3]) //=> 2 Returns a random element from the array
wsl.randFloat(1.0, 10.0) //=> 7.234 Returns a random float between min and max
wsl.randInt(1, 10) //=> 7 Returns a random integer between min and max (inclusive)
wsl.randIntNormal(1, 10) //=> 6 Returns a random integer using normal distribution between min and max
wsl.randNormal(1.0, 10.0) //=> 5.123 Returns a random float using normal distribution between min and max
wsl.random() //=> 0.23489210239 Returns a float between 0.0 and 1.0 using the seeded PRNG
wsl.rollDice(3, 6) //=> [4, 2, 6] Rolls multiple dice and returns array of results
wsl.sample([1, 2, 3, 4, 5], 3) //=> [2, 5, 1] Returns n random elements from the array without replacement
wsl.shuffle([1, 2, 3]) //=> [3, 1, 2] Returns a shuffled copy of the array
wsl.weightedRandom([0.1, 0.7, 0.2]) //=> 1 Returns index based on weighted probabilities
~~~~~
Template pattern syntax:
~~~~~
Syntax: {{variable}}
Desc: Insert state variable values into your text using Handlebars-like syntax. Variables may be strings, numbers, or booleans.

Syntax: {$ expression $}
Desc: Evaluate JavaScript expressions and insert the result. You can do math, call functions, or create logic.

Syntax: [[dynamic|text|variations]]
Desc: Create dynamic text variations that change each time they're encountered. Use pipe symbols to separate options. Add ^ for cycling through options in order, or ~ for shuffled rotation.

Syntax: {% prompt %}
Desc: Generate text using AI based on your prompt. The AI creates content that fits naturally into your story.

Syntax: --- Front matter ---
Desc: Declare global data and metadata using YAML inside of front matter-like blocks anywhere inside your .wsl file. Note: Front matter is processed at compile time and all values are unscoped globals that can be referred to anywhere in your story.

Syntax: Pattern processing order - important
Desc: Templates (other than front matter) are processed at runtime, just as they are encountered, in this specific order: (1) {{variables}} first, (2) {$ expressions $} second, (3) [[random|variations]] third, (4) {% AI prompts %} last. In this way, later patterns can use results from earlier ones.
~~~~~
Story example using moss features:
~~~~~
=== main.wsl ===
```wsl
<!--
This is an example interactive audio story written in Welltale Story Language (WSL).
WSL is, at its simplest, just XML. Tags are used to structure your content and specify your story flow.
Basic tags like <p> or <audio> will play content to the listener.
By default, story flow occurs in a linear manner; when tags are nested, traversal occurs depth-first.
Things get more interesting with tags like <jump> and <if> and <while>, which let you create complex, nonlinear story logic.
The <script> tag can be used if you need more advanced logic with a full sandboxed JavaScript environment.
And importantly, the <input> tag lets you prompt the listener for input.
WSL also supports templating and interpolation syntax to make it even easier to create dynamic content that changes every playthru.
-->

<!--
We can define metadata and variables by embedding YAML inside of front matter blocks.
You could also put this into a separate file such as data.yml, and it will be loaded.
-->
---
title: Example Quest
author: Matthew Trost
tags: [example, fantasy]
description: This example Welltale story shows how to use all Welltale Story Language features.

# For words that the text-to-speech engine might not be familiar with, you can include a simple pronunciation dictionary like so:
pronunciations:
  Trost: Troast
  Examplaria: exampLAHria

# You can define custom voices and then reference them in your game script by id, e.g. <p voice="someVoice">.
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
  
# You can also define the initial values of state variables your story will use
player:
  gold: 35
  inventory: ["bread"]
shop:
  potion: 30
  compass: 50
  sword: 20
---

<!--
After the front matter YAML, this file looks much more like a typical WSL story file.
Here, the <intro> tag plays content only once: when the player first begins a story.
-->
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

<!--
  Macro definitions are available to transform tags to make your authoring experience more expressive.
  You can rename tags and add attributes on the fly, reducing the amount of boilerplate in your story.
-->
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
    To set a state variable (i.e. to be available after the script runs), use the `wsl.set(key, value)` function.
  -->
  <script>
    wsl.set("riddleSolved", reply.includes(riddle.answer))
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
  </if>
  <if cond="!riddleSolved">
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
      wsl.set("stumped", isUnrhymable);
      wsl.set("rhymeTurns", rhymeTurns + 1);
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

      <!-- Else blocks are a hidden feature; they ONLY work when placed INSIDE of an If block -->
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
    </if>

  </while>

  <jump to="outpost" />
</div>

<div id="outpost">
  <!-- Initialize player's inventory from external data file -->
  <script>
    wsl.set("gold", player.starting_gold);
    wsl.set("inventory", player.starting_inventory);
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
        wsl.set("gold", gold - price)
        wsl.set("inventory", [...inventory, item])
      </script>
      <narrator>
        You purchase the {{item}}. You now have {{gold}} gold remaining.
      </narrator>
    </if>
    <if cond="gold < price">
      <merchant>
        [apologetically] Ah, but you need {{price}} gold for the {{item}}. You only have {{gold}}.
      </merchant>
    </if>
  </block>

  <block id="sell-item">
    <script>
      const hasItem = inventory.includes(item);
      wsl.set("hasItem", hasItem);
    </script>
    <if cond="hasItem">
      <merchant>
        I'll give you {{price}} gold for your {{item}}.
      </merchant>
      <script>
        wsl.set("gold", gold + price)
        wsl.set("inventory", inventory.filter(i => i !== item))
      </script>
      <narrator>
        You sell the {{item}}. You now have {{gold}} gold.
      </narrator>
    </if>
    <if cond="!hasItem">
      <merchant>
        [confused] But you don't have a {{item}} to sell me!
      </merchant>
    </if>
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

    <if cond="!intent.includes('buy') && !intent.includes('sell')">
      <narrator>
        Anything else? You can buy items, sell items, or leave.
      </narrator>
      <continue />
    </if>
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
        wsl.set("offeredItem", analysis.offered);
      }
      if (analysis.convinced) {
        wsl.set("trollSatisfied", true);
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