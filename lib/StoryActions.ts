import dedent from "dedent";
import { omit } from "lodash";
import { TSerial } from "../typings";
import {
  castToBoolean,
  castToTypeEnhanced,
  ensureArray,
  isTruthy,
} from "./EvalCasting";
import { isValidUrl, toHttpMethod } from "./HTTPHelpers";
import { parseFieldGroupsNested } from "./InputHelpers";
import { safeJsonParse, safeYamlParse } from "./JSONHelpers";
import { parseNumberOrNull } from "./MathHelpers";
import { makeCheckpoint, recordEvent } from "./StoryCheckpointUtils";
import {
  DESCENDABLE_TAGS,
  HOST_ID,
  INPUT_TAGS,
  normalizeModels,
  PLAYER_ID,
  publicAtts,
  setState,
  TEXT_CONTENT_TAGS,
  userVoicesAndPresetVoices,
} from "./StoryConstants";

import { extractInput } from "./StoryInput";
import {
  countStackContainersBetween,
  extractReadableBlocks,
  marshallText,
  nearestAncestorOfType,
  nextNode,
  searchForNode,
  skipBlock,
} from "./StoryNodeHelpers";
import { renderAtts, renderText } from "./StoryRenderMethods";
import {
  ActionHandler,
  ImageAspectRatio,
  ImageModelSlug,
  OP,
  StoryEvent,
  StoryNode,
} from "./StoryTypes";
import { cleanSplit, isBlank, snorm } from "./TextHelpers";

function tagOutKey(atts: Record<string, TSerial>, fallback: string = "_") {
  return (atts.key ?? fallback).toString();
}

function getDialogId(atts: Record<string, TSerial>) {
  return atts.dialog ?? atts.id;
}

export const ACTION_HANDLERS: ActionHandler[] = [
  {
    tags: ["scope"],
    docs: {
      desc: dedent`
        Creates a new state variable scope for child elements. State variables defined within the scope are
        isolated and don't affect the parent scope. Useful for temporary variables, loop iterations,
        or any situation where you want to prevent variable pollution.
      `,
      ex: [
        {
          code: dedent`
            <var name="health" value="100" />
            <scope>
              <!-- This health variable is isolated -->
              <var name="health" value="50" />
              <p>In battle, your health is {{health}}</p>
            </scope>
            <p>After battle, your health is {{health}}</p> <!-- Still 100 -->
          `,
        },
      ],
      cats: ["descendable", "dev"],
    },
    syntax: {
      block: true,
      atts: {},
    },
    exec: async (ctx) => {
      // Push a new scope onto the callStack when entering
      const returnAddress =
        nextNode(ctx.node, ctx.session.root, false)?.node.addr ??
        ctx.origin.addr;
      const readableWriteableScope = {};
      ctx.session.stack.push({
        returnAddress,
        writeableScope: readableWriteableScope,
        readableScope: readableWriteableScope,
        blockType: "scope",
      });
      // Enter the scope (process children)
      const next =
        ctx.node.kids.length > 0
          ? { node: ctx.node.kids[0] }
          : nextNode(ctx.node, ctx.session.root, false);
      return {
        ops: [],
        next,
      };
    },
  },
  {
    tags: ["llm:parse"],
    docs: {
      desc: dedent`
        Extracts structured data from text content using AI. The tag analyzes the inner text and extracts
        values according to a schema defined by the attributes. Each attribute becomes a field in the extracted
        data, with optional type and description properties specified using dot notation.
        
        The output of this tag is stored in the \`_\` state variable, or the variable given by the \`key\` attribute if present.
      `,
      ex: [
        {
          note: "Basic usage",
          code: dedent`
            <llm:parse
              key="item"
              productName="name of the product being discussed"
              rating="customer satisfaction level"
            >
              {{customerReview}}
            </llm:parse>
            <p>The product is {{item.productName}}</p>
            <p>The rating is {{item.rating}}</p>
          `,
        },
        {
          note: "Extended usage with explicit types",
          code: dedent`
            <llm:parse
              key="analysis"
              
              summary="a brief summary of the text"
              
              sentiment.type="number"
              sentiment.description="sentiment score from -1.0 (negative) to 1.0 (positive)"
              
              hasQuestion.type="boolean"
              hasQuestion.description="whether the text contains a question"
              
              topics.type="array<string>"
              topics.description="main topics discussed in the text"
            >
              {{input}}
            </llm:parse>
            <p>Summary: {{analysis.summary}}</p>
            <p>Sentiment score: {{analysis.sentiment}}</p>
            <if cond="analysis.hasQuestion">
              <p>The user asked a question.</p>
            </if>
          `,
        },
      ],
      cats: ["dev", "ai"],
    },
    syntax: {
      block: true,
      atts: {
        key: {
          type: "string",
          desc: "Variable name to store the extracted data (default: 'parse')",
          req: false,
          default: "parse",
        },
        web: {
          type: "boolean",
          desc: "Enable web search as the AI extracts the data",
          req: false,
          default: "false",
        },
        "[field]": {
          type: "string",
          desc: "Simple field: attribute name becomes field name, value becomes description",
          req: false,
        },
        "[field].type": {
          type: "string",
          desc: "Field type: string, number, boolean, array<string>, etc.",
          req: false,
          default: "string",
        },
        "[field].description": {
          type: "string",
          desc: "Detailed description of what to extract for this field",
          req: false,
        },
        models: {
          type: "string",
          desc: "Comma-separated list of model slugs to use",
          req: false,
        },
        seed: {
          type: "string",
          desc: "Seed for deterministic generation (provider-specific usage)",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const schemaAll = parseFieldGroupsNested(
        omit(publicAtts(atts), "key", "web", "models", "seed")
      );
      const schema: Record<string, TSerial> = {};
      for (const k in schemaAll) {
        schema[k] = schemaAll[k];
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
      const seed = atts.seed;
      const result = await ctx.provider.generateJson(
        dedent`
          Extract structured data from the input per the schema.
          <input>${prompt}</input>
        `,
        schema,
        { models, useWebSearch, seed }
      );
      setState(ctx.scope, tagOutKey(atts), result as unknown as TSerial);
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: ["llm:tag"],
    docs: {
      desc: dedent`
        Classifies input text into predefined categories using AI.
        
        The tag analyzes the text content and returns an array of matching labels based on their
        descriptions. Each attribute becomes a potential label with its value serving as the description
        for classification.
        
        The output of this tag is stored in the \`_\` state variable, or the variable given by the \`key\` attribute if present.
        
        The AI returns only the labels that match the content, supporting multiple label assignment.
      `,
      ex: [
        {
          code: dedent`
            <llm:tag
              key="tags"
              question="user is asking a question"
              complaint="user is making a complaint"
              praise="user is giving positive feedback"
            >
              {{input}}
            </llm:tag>
            <if cond="tags.includes('question')">
              <p>I'll help answer your question.</p>
            </if>
          `,
        },
      ],
      cats: ["ai"],
    },
    syntax: {
      block: true,
      atts: {
        key: {
          type: "string",
          desc: "Variable name to store the array of matching labels (default: 'tags')",
          req: false,
          default: "tags",
        },
        web: {
          type: "boolean",
          desc: "Enable web search for current information during classification",
          req: false,
          default: "false",
        },
        "[label]": {
          type: "string",
          desc: "Label name as attribute, description as value. AI returns labels that match.",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const labels = omit(publicAtts(atts), "key", "web");
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
      const out = await ctx.provider.generateJson(
        dedent`
          Tag the input using 0 or more of the given labels, based on each label's description.
          <input>${prompt}</input>
          <labels>${JSON.stringify(labels, null, 2)}</labels>
          Return only labels that fit the content. Return multiple if relevant.
        `,
        { labels: "array<string> - Classification labels for the input" },
        { models, useWebSearch }
      );
      setState(ctx.scope, tagOutKey(atts), ensureArray(out.labels ?? []));
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: ["llm:score"],
    docs: {
      desc: dedent`
        Scores text content on multiple dimensions using AI. Each attribute becomes a scoring dimension,
        and the AI returns a numeric score between \`0.0\` and \`1.0\` for each dimension. This is useful for
        sentiment analysis, content moderation, or any scenario requiring quantitative text evaluation.
        
        The output of this tag is stored in the \`_\` state variable, or the variable given by the \`key\` attribute if present.
      `,
      ex: [
        {
          code: dedent`
            <llm:score
              key="sentiment"
              positivity="how positive the message is"
              anger="level of anger expressed"
              sarcasm="amount of sarcasm detected"
            >
              {{userInput}}
            </llm:score>
            <if cond="sentiment.anger > 0.7">
              <p>I can see you're upset. Let me help calm things down.</p>
            </if>
          `,
        },
      ],
      cats: ["ai"],
    },
    syntax: {
      block: true,
      atts: {
        key: {
          type: "string",
          desc: "Variable name to store the scores object (default: 'score')",
          req: false,
          default: "score",
        },
        web: {
          type: "boolean",
          desc: "Enable web search for fact-checking during scoring",
          req: false,
          default: "false",
        },
        "[dimension]": {
          type: "string",
          desc: "Scoring dimension name as attribute, description as value. Returns 0.0-1.0 score.",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const cleaned = omit(publicAtts(atts), "key", " web");
      const schema: Record<string, TSerial> = {};
      for (const k in cleaned) {
        if (!k.includes(".")) schema[k] = "number";
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
      const seed = atts.seed;
      const result = await ctx.provider.generateJson(
        dedent`
          Score the input for each key between 0.0 and 1.0.
          Return only numeric scores.
          <input>${prompt}</input>
        `,
        schema,
        { models, useWebSearch, seed }
      );
      setState(ctx.scope, tagOutKey(atts), result as unknown as TSerial);
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: ["llm:generate"],
    docs: {
      desc: dedent`
        Generates structured content using AI based on instructions and a schema.
        
        Unlike \`<llm:parse>\` which extracts data from existing text, this tag creates new content
        according to specifications. Supports complex nested structures and various data types.
        
        The output of this tag is stored in the \`_\` state variable, or the variable given by the \`key\` attribute if present.
      `,
      ex: [
        {
          note: "Basic usage",
          code: dedent`
            <llm:generate
              key="story"
              title="a compelling title for the story"
              summary="brief 2-3 sentence summary"
              genre="primary genre classification"
            >
              Create a story concept about: {{userIdea}}
            </llm:generate>
            <p>Title: {{story.title}}</p>
            <p>{{story.summary}}</p>
          `,
        },
        {
          note: "Extended usage with explicit types",
          code: dedent`
            <llm:generate
              key="character"
              name.type="string"
              name.description="character's full name"
              age.type="number"
              age.description="character's age in years"
              personality.type="array<string>"
              personality.description="3-5 personality traits"
              backstory.type="string"
              backstory.description="brief character backstory"
              motivations.primary.type="string"
              motivations.secondary.type="string"
            >
              Create a character that fits this role: {{characterRole}}
              Setting: {{storySetting}}
            </llm:generate>
            <p>Meet {{character.name}}, age {{character.age}}.</p>
          `,
        },
      ],
      cats: ["ai"],
    },
    syntax: {
      block: true,
      atts: {
        key: {
          type: "string",
          desc: "Variable name to store the generated data (default: 'generate')",
          req: false,
          default: "generate",
        },
        web: {
          type: "boolean",
          desc: "Enable web search for current information during generation",
          req: false,
          default: "false",
        },
        "[field]": {
          type: "string",
          desc: "Simple field: attribute name becomes field name, value becomes description",
          req: false,
        },
        "[field].type": {
          type: "string",
          desc: "Field type: string, number, boolean, array<string>, etc.",
          req: false,
          default: "string",
        },
        "[field].description": {
          type: "string",
          desc: "Detailed description of what to generate for this field",
          req: false,
        },
        models: {
          type: "string",
          desc: "Comma-separated list of model slugs to use",
          req: false,
        },
        seed: {
          type: "string",
          desc: "Seed for deterministic generation (provider-specific usage)",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const schemaAll = parseFieldGroupsNested(
        omit(publicAtts(atts), "key", "web", "models", "seed")
      );
      const schema: Record<string, TSerial> = {};
      for (const k in schemaAll) {
        schema[k] = schemaAll[k];
      }
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
      const seed = atts.seed;
      const result = await ctx.provider.generateJson(
        dedent`
          Generate data per the instruction, conforming to the schema.
          <instruction>${prompt}</instruction>
        `,
        schema,
        { models, useWebSearch, seed }
      );
      setState(ctx.scope, tagOutKey(atts), result as unknown as TSerial);
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: ["llm:text"],
    docs: {
      desc: dedent`
        Generates unstructured text content using AI based on a prompt. This is useful for creating
        narrative content, descriptions, dialogue, or any text that doesn't need to be parsed into
        structured data. The generated text is stored as a simple string.
        
        The output of this tag is stored in the \`_\` state variable, or the variable given by the \`key\` attribute if present.
      `,
      ex: [
        {
          code: dedent`
            <llm:text key="description">
              Write a vivid description of a mysterious forest at twilight.
              Include sensory details and create an atmosphere of wonder.
            </llm:text>
            <p>{{description}}</p>
          `,
        },
        {
          code: dedent`
            <llm:text key="narration" web="true">
              Generate a news report about: {{currentEvent}}
              Include current date and accurate information.
            </llm:text>
            <p from="News Reporter">{{narration}}</p>
          `,
        },
      ],
      cats: ["ai"],
    },
    syntax: {
      block: true,
      atts: {
        key: {
          type: "string",
          desc: "Variable name to store the generated text (default: 'text')",
          req: false,
          default: "text",
        },
        web: {
          type: "boolean",
          desc: "Enable web search for current information during generation",
          req: false,
          default: "false",
        },
        models: {
          type: "string",
          desc: "Comma-separated list of model slugs to use",
          req: false,
        },
        seed: {
          type: "string",
          desc: "Seed for deterministic generation (provider-specific usage)",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const prompt = await renderText(await marshallText(ctx.node, ctx), ctx);
      const useWebSearch = isTruthy(atts.web) ? true : false;
      const models = normalizeModels(ctx.options, atts.models);
      const seed = atts.seed;
      const result = await ctx.provider.generateText(prompt, {
        models,
        useWebSearch,
        seed,
      });
      setState(ctx.scope, tagOutKey(atts), snorm(result));
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: ["var"],
    docs: {
      desc: dedent`
        Defines or updates a variable in the current scope. Variables can hold any type of data
        and can be used in template expressions like \`{{variableName}}\`.
      `,
      ex: [
        {
          note: "Basic usage",
          code: dedent`
            <var name="playerName" value="Alex" />
            <var name="health" value="100" type="number" />
            <var name="isAlive" value="true" type="boolean" />
             
            <!-- Using the inner content as value -->
            <var name="story">
              Once upon a time, in a land far away...
            </var>
            
          `,
        },
        {
          note: "Advanced usage and expressions",
          code: dedent`
            <var name="maxHealth" value="100" type="number" />
            <var name="damage" value="{$ Math.floor(Math.random() * 20) + 10 $}" />
            <var name="health" value="{$ maxHealth - damage $}" />
            <var name="inventory" value="{$ ['sword', 'shield', 'potion'] $}" />
            <var name="stats" value="{$ {strength: 10, agility: 15, magic: 5} $}" />
          `,
        },
      ],
      cats: ["dev"],
    },
    syntax: {
      block: true,
      atts: {
        name: {
          type: "string",
          desc: "Variable name (aliases: key, id)",
          req: true,
        },
        value: {
          type: "string",
          desc: "Value to assign. Can be literal or expression. If omitted, uses inner content.",
          req: false,
        },
        type: {
          type: "string",
          desc: "Type to cast value to: string, number, boolean, array, object, date",
          req: false,
          default: "string",
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const key = atts.name ?? atts.key ?? atts.id;
      let rollup = (await marshallText(ctx.node, ctx)).trim();
      const value = await renderText(
        !isBlank(rollup) ? rollup : atts.value,
        ctx
      );
      setState(ctx.scope, key, castToTypeEnhanced(value, atts.type));
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.session.root, false),
      };
    },
  },
  {
    tags: ["code", "script"],
    docs: {
      desc: dedent`
        Executes JavaScript or TypeScript code with full access to state variables in the current scope.
        State variables can be read and modified directly using \`get(key)\` and \`set(key, value)\`.
        
        Code runs in a sandboxed environment.
      `,
      ex: [
        {
          code: dedent`
            <script>
              // Calculate combat damage with modifiers
              const baseDamage = 10;
              const weaponBonus = inventory.includes('magic sword') ? 5 : 0;
              const criticalHit = Math.random() > 0.9;
              
              damage = baseDamage + weaponBonus;
              if (criticalHit) {
                damage *= 2;
                isCritical = true;
              }
              
              // Make available to state
              set("isCritical", isCritical)
              set("damage", damage)
            </script>
            <if cond="isCritical">
              <p>Critical hit! You deal {{damage}} damage!</p>
            </if>
          `,
        },
      ],
      cats: ["dev"],
    },
    syntax: {
      block: true,
      atts: {},
    },
    exec: async (ctx) => {
      const text = await renderText(await marshallText(ctx.node, ctx), ctx);
      await ctx.evaluator(text, ctx.scope);
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.session.root, false),
      };
    },
  },
  {
    tags: ["data"],
    docs: {
      desc: dedent`
        Loads structured data from JSON or YAML format, either from the tag's content or from a URL.
        Useful for loading configuration, game data, or any structured information. The data is stored
        in the state variable given by the \`key\` attribute.
      `,
      ex: [
        {
          note: "JSON",
          code: dedent`
            <data key="weapons">
              [
                {"name": "sword", "damage": 10, "cost": 100},
                {"name": "axe", "damage": 15, "cost": 150},
                {"name": "staff", "damage": 5, "cost": 200, "magic": true}
              ]
            </data>
            <p>Available weapons: {$ weapons.map(w => w.name).join(', ') $}</p>
          `,
        },
        {
          note: "YAML",
          code: dedent`
            <data key="npc" format="yaml">
              name: Elder Marcus
              age: 72
              location: Village Square
              quests:
                - Find the lost amulet
                - Defeat the goblin chief
              dialogue:
                greeting: "Welcome, young adventurer!"
                farewell: "May the gods watch over you."
            </data>
            <p from="{{npc.name}}">{{npc.dialogue.greeting}}</p>
          `,
        },
      ],
      cats: ["dev", "http"],
    },
    syntax: {
      block: true,
      atts: {
        key: {
          type: "string",
          desc: "Variable name to store the loaded data",
          req: false,
          default: "data",
        },
        src: {
          type: "string",
          desc: "URL to load data from (aliases: href, url)",
          req: false,
        },
        format: {
          type: "string",
          desc: "Data format: json or yaml/yml. Auto-detected from content-type if loading from URL.",
          req: false,
          default: "json",
        },
        method: {
          type: "string",
          desc: "HTTP method when loading from URL",
          req: false,
          default: "GET",
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const url = atts.src ?? atts.href ?? atts.url;
      let raw = "";
      let fmt = (atts.format ?? "json").toLowerCase();
      if (!isBlank(url) && isValidUrl(url)) {
        const { data, statusCode, contentType } = await ctx.provider.fetchUrl({
          url,
          method: toHttpMethod(atts.method ?? "GET"),
        });
        if (statusCode >= 200 && statusCode <= 299) {
          raw = data;
        }
        if (contentType.includes("json")) {
          fmt = "json";
        } else if (
          contentType.includes("yaml") ||
          contentType.includes("yml")
        ) {
          fmt = "yaml";
        }
      }
      // Treated as the data in the normal case, or fallback if we have a URL
      if (isBlank(raw)) {
        raw = await renderText(await marshallText(ctx.node, ctx, ""), ctx);
      }
      let val = null as TSerial | null;
      if (fmt === "yaml" || fmt === "yml") {
        const parsed = safeYamlParse(raw);
        val = (parsed ?? null) as unknown as TSerial | null;
      } else if (fmt === "json") {
        const parsed = safeJsonParse(raw);
        val = (parsed ?? null) as unknown as TSerial | null;
      } else {
        val = raw;
      }
      setState(ctx.scope, tagOutKey(atts), val);
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: DESCENDABLE_TAGS.filter((tag) => tag !== "scope"),
    docs: {
      desc: dedent`
        Many container elements are available to structure the story content.

        They can contain any other tags to arbitrary depth.

        These tags organize the narrative into logical sections and can contain other tags.
      `,
      ex: [
        {
          code: dedent`
            <!-- Basic story structure -->
            <div id="chapter-1">
              <p>Our story begins...</p>
              
              <section id="first-encounter">
                <p>You meet a mysterious stranger...</p>
              </section>
            </div>
          `,
        },
      ],
      cats: ["descendable"],
    },
    syntax: {
      block: true,
      atts: {
        id: {
          type: "string",
          desc: "Unique identifier for navigation and jumping",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      // Auto-checkpoint on entering a section
      if (ctx.node.type === "sec") {
        makeCheckpoint(ctx, []);
      }
      const next = nextNode(ctx.node, ctx.session.root, true);
      return {
        ops: [],
        next: next,
      };
    },
  },
  {
    tags: TEXT_CONTENT_TAGS,
    docs: {
      desc: dedent`
        Text content elements contain narration, dialogue - any content that gets played as spoken audio to the player.

        This content is rendered into audio clips automatically by Welltale using text-to-speech, and then played on the story client to the player.

        The \`name\` attribute can be used to indicate the person speaking. If none given, \`"HOST"\` is used.

        The \`voice\` attribute can assign a specific text-to-speech voice to the speech. If none is given, the default voice (the one used for \"HOST\") is used. Voices are defined in data files (data.yml or data.json) in your story directory.

        Warning: The only tag you can place inside of a text content element is \`<when>\`. See the docs on \`<when>\` for adding expressive conditional logic to your text elements.
      `,
      ex: [
        {
          code: dedent`
            <p>The sun sets over the ancient castle.</p>
            <p>You approach the heavy wooden gates.</p>
            <p from="Guard" voice="Gruff">Halt! Who goes there?</p>
          `,
        },
      ],
      cats: ["render"],
    },
    syntax: {
      block: true,
      atts: {
        name: {
          type: "string",
          desc: "Speaker/character name",
          req: false,
          default: "HOST",
        },
        voice: {
          type: "string",
          desc: "Voice ID for text-to-speech generation",
          req: false,
        },
        to: {
          type: "string",
          desc: "Comma-separated list of recipients who hear this",
          req: false,
          default: "PLAYER",
        },
        obs: {
          type: "string",
          desc: "Comma-separated list of observers who witness but don't hear directly",
          req: false,
        },
        tags: {
          type: "string",
          desc: "Comma-separated tags affecting speech generation",
          req: false,
        },
        volume: {
          type: "number",
          desc: "Volume level from 0.0 to 1.0",
          req: false,
        },
        background: {
          type: "boolean",
          desc: "Play narration in background without blocking",
          req: false,
          default: "false",
        },
        fadeAt: {
          type: "number",
          desc: "Start fading at this time in milliseconds",
          req: false,
        },
        fadeDuration: {
          type: "number",
          desc: "Duration of fade in milliseconds",
          req: false,
        },
        seed: {
          type: "string",
          desc: "Seed for deterministic generation (provider-specific usage)",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const next = nextNode(ctx.node, ctx.session.root, false);
      const ops: OP[] = [];
      const atts = await renderAtts(ctx.node.atts, ctx);
      let text = "";
      if (isBlank(text)) {
        // Assume text nodes never contain actionable children, only text
        text = await renderText(await marshallText(ctx.node, ctx), ctx);
      }
      // Early exit spurious empty nodes
      if (isBlank(text)) {
        return {
          ops,
          next,
        };
      }
      const event: StoryEvent = {
        node: {
          type: ctx.node.type,
          addr: ctx.node.addr,
          atts,
        },
        body: snorm(text),
        from: atts.from ?? atts.voice ?? HOST_ID,
        to: atts.to ?? PLAYER_ID,
        obs: atts.obs ? cleanSplit(atts.obs, ",") : [],
        tags: atts.tags ? cleanSplit(atts.tags, ",") : [],
        time: Date.now(),
      };
      const { url } = ctx.options.doGenerateAudio
        ? await ctx.provider.generateSpeech(
            {
              speaker: event.from,
              voice: atts.voice ?? event.from,
              tags: event.tags,
              body: event.body,
              pronunciations: ctx.session.pronunciations,
            },
            userVoicesAndPresetVoices(Object.values(ctx.session.voices)),
            { seed: atts.seed }
          )
        : { url: "" };
      setState(ctx.scope, tagOutKey(atts), text);
      ops.push({
        type: "play-media",
        media: url,
        event,
        volume: parseNumberOrNull(atts.volume),
        // Probably not likely to be used unless someone wants trailing off speech?
        fadeAtMs: parseNumberOrNull(atts.fadeAt),
        fadeDurationMs: parseNumberOrNull(atts.fadeDuration),
        background: castToBoolean(atts.background),
      });
      recordEvent(ctx, event);
      return {
        ops,
        next,
      };
    },
  },
  {
    tags: ["checkpoint"],
    docs: {
      desc: dedent`
        Creates a save point in the story that users can resume from. Checkpoints store the current
        state, variables, and conversation history.
        
        Note: Checkpoits are automatically created at section boundaries
        and before input prompts, but can also be manually placed for important story moments.
      `,
      ex: [
        {
          code: dedent`
            <!-- Manual checkpoint before important choice -->
            <checkpoint />
            <p>This decision will change everything. Choose wisely.</p>
            <input choice.description="save the village or pursue the villain" />
            
            <!-- Checkpoint is automatic here due to input -->
          `,
        },
      ],
      cats: ["control_flow", "dev"],
    },
    syntax: {
      block: false,
      atts: {},
    },
    exec: async (ctx) => {
      makeCheckpoint(ctx, []);
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: ["if"],
    docs: {
      desc: dedent`
        Conditional execution of story content. Evaluates a JavaScript or TypeScript expression and executes
        child elements only if the condition is true.
        
        Note: \`<else>\` blocks are supported, but they must be _inside_ the \`<if>\` block.
        \`<else>\` tags that appear outside of \`<if>\` will be ignored.
      `,
      ex: [
        {
          code: dedent`
            <if cond="playerName === 'Alex'">
              <p>Ah, Alex! I've been expecting you.</p>
              <else>
                <p>Welcome, stranger. What brings you here?</p>
              </else>
            </if>
          `,
        },
      ],
      cats: ["control_flow"],
    },
    syntax: {
      block: true,
      atts: {
        cond: {
          type: "string",
          desc: "JavaScript expression to evaluate. Has access to all scope variables.",
          req: true,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      let next;
      const conditionTrue = await ctx.evaluator(atts.cond, ctx.scope);
      if (conditionTrue && ctx.node.kids.length > 0) {
        // Find first non-else child
        const firstNonElse = ctx.node.kids.find((k) => k.type !== "else");
        if (firstNonElse) {
          next = { node: firstNonElse };
        } else {
          next = nextNode(ctx.node, ctx.session.root, false);
        }
      } else {
        // Look for else block
        const elseChild = ctx.node.kids.find((k) => k.type === "else");
        if (elseChild && elseChild.kids.length > 0) {
          next = { node: elseChild.kids[0] };
        } else {
          next = nextNode(ctx.node, ctx.session.root, false);
        }
      }
      return {
        ops: [],
        next,
      };
    },
  },
  {
    tags: ["while"],
    docs: {
      desc: dedent`
        Repeats child elements while a condition remains true. The condition is evaluated before
        each iteration. Supports \`<break>\` and \`<continue>\` statements for loop control.
      `,
      ex: [
        {
          code: dedent`
            <var name="attempts" value="0" type="number" />
            <while cond="attempts < 3 && !hasKey">
              <p>You search the room...</p>
              <var name="attempts" value="{$ attempts + 1 $}" />
              <if cond="Math.random() > 0.7">
                <p>You found a key!</p>
                <var name="hasKey" value="true" type="boolean" />
              </if>
            </while>
          `,
        },
        {
          code: dedent`
            <while cond="true">
              <input id="command" />
              <if cond="command === 'quit'">
                <break />
              </if>
              <if cond="command === 'skip'">
                <continue />
              </if>
              <p>You entered: {{command}}</p>
            </while>
          `,
        },
      ],
      cats: ["control_flow"],
    },
    syntax: {
      block: true,
      atts: {
        cond: {
          type: "string",
          desc: "JavaScript expression evaluated before each iteration",
          req: true,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      let next;
      const conditionTrue = await ctx.evaluator(atts.cond, ctx.scope);
      if (conditionTrue && ctx.node.kids.length > 0) {
        next = nextNode(ctx.node, ctx.session.root, true);
      } else {
        next = nextNode(ctx.node, ctx.session.root, false);
      }
      return {
        ops: [],
        next,
      };
    },
  },
  {
    tags: ["continue"],
    syntax: {
      block: false,
      atts: {},
    },
    exec: async (ctx) => {
      const w = nearestAncestorOfType(ctx.node, ctx.session.root, "while");
      if (!w) {
        return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
      }
      const count = countStackContainersBetween(ctx.node, w, ctx.session.root);
      const toPop = Math.min(count, ctx.session.stack.length);
      for (let i = 0; i < toPop; i++) ctx.session.stack.pop();
      ctx.session.target = w.addr;
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: ["break"],
    syntax: {
      block: false,
      atts: {},
    },
    exec: async (ctx) => {
      const w = nearestAncestorOfType(ctx.node, ctx.session.root, "while");
      if (!w) {
        return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
      }
      const after = nextNode(w, ctx.session.root, false);
      if (!after) {
        return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
      }
      const count = countStackContainersBetween(ctx.node, w, ctx.session.root);
      const toPop = Math.min(count, ctx.session.stack.length);
      for (let i = 0; i < toPop; i++) ctx.session.stack.pop();
      ctx.session.target = after.node.addr;
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: ["jump"],
    docs: {
      desc: dedent`
        Navigates to another section of the story by ID. Can be conditional using the 'if' attribute.
        The target must be an element with an id attribute (typically \`<div>\` elements, but can be any type of element).
        This is the primary way to implement branching narratives and story choices.
      `,
      ex: [
        {
          code: dedent`
            <p>Which path do you choose?</p>
            <input choice.description="left or right" />
            <jump to="path-{{choice}}" />
            
            <div id="path-left">
              <p>You venture into the dark forest...</p>
            </div>
            
            <div id="path-right">
              <p>You follow the sunny meadow trail...</p>
            </div>
          `,
        },
      ],
      cats: ["control_flow"],
    },
    syntax: {
      block: false,
      atts: {
        to: {
          type: "string",
          desc: "ID of the target element to jump to (aliases: target, destination)",
          req: true,
        },
        if: {
          type: "string",
          desc: "JavaScript condition that must be true for the jump to execute",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      let next: { node: StoryNode } | null = null;
      if (!atts.if || (await ctx.evaluator(atts.if, ctx.scope))) {
        next = searchForNode(
          ctx.session.root,
          atts.to ?? atts.target ?? atts.destination
        );
      } else {
        next = nextNode(ctx.node, ctx.session.root, false);
      }
      if (next && next.node === ctx.node) {
        console.warn("Attempted <jump> to same node; nullifying path");
        next = null;
      }
      return {
        ops: [],
        next,
      };
    },
  },
  {
    tags: ["sleep"],
    docs: {
      desc: dedent`
        Pauses story execution for a specified duration. Useful for dramatic timing, letting
        audio play, or creating rhythm in the narrative. The duration is in milliseconds.

        Note: During sleep, background audio continues playing.
      `,
      ex: [
        {
          code: dedent`
            <p>The door slowly creaks open...</p>
            <sleep duration="2000" /> <!-- 2 second dramatic pause -->
            <p>A figure emerges from the shadows!</p>
          `,
        },
      ],
      cats: ["control_flow"],
    },
    syntax: {
      block: false,
      atts: {
        duration: {
          type: "number",
          desc: "Pause duration in milliseconds (aliases: for, ms)",
          req: false,
          default: "1",
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      return {
        ops: [
          {
            type: "sleep",
            duration:
              parseNumberOrNull(atts.duration ?? atts.for ?? atts.ms) ?? 1,
          },
        ],
        next: nextNode(ctx.node, ctx.session.root, false),
      };
    },
  },
  {
    // Intro nodes process their children like any container
    tags: ["intro"],
    docs: {
      desc: dedent`
        Defines content that plays at the start of a story or when starting fresh. Typically contains
        introductory narration, music, or scene-setting. This content is skipped when resuming a saved
        story. Only one intro section should exist per story file.
      `,
      ex: [
        {
          code: dedent`
            <intro>
              <music duration="10000" fadeAt="4000" fadeDuration="6000" background="true">
                Epic orchestral theme, rising strings, heroic brass
              </music>
              <sleep duration="2000" />
              <p>In a world where magic and technology collide...</p>
              <p>One hero must rise to face an ancient evil...</p>
            </intro>
          `,
        },
      ],
      cats: ["descendable", "control_flow"],
    },
    syntax: {
      block: true,
      atts: {},
    },
    exec: async (ctx) => {
      // Check if we're in an intro context (i.e., this intro was pushed onto stack by engine)
      const inIntroContext = ctx.session.stack.some(
        (frame) => frame.blockType === "intro"
      );

      if (inIntroContext) {
        // We're executing the intro from the engine, process children
        const next = nextNode(ctx.node, ctx.session.root, true);
        return { ops: [], next };
      } else {
        // Skip intro in normal flow
        return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
      }
    },
  },
  {
    tags: ["outro"],
    docs: {
      desc: dedent`
        Defines content that plays when a story ends. Can contain credits, final narration, or
        closing music. The outro is triggered by the story engine when reaching a story endpoint.
      `,
      ex: [
        {
          code: dedent`
            <outro>
              <music background="true" fadeAt="8000" fadeDuration="4000">
                Melancholic piano melody, slow and reflective
              </music>
              <p>And so ends our tale...</p>
              <sleep duration="3000" />
              <p>Thank you for joining this adventure.</p>
              <p from="Credits">Story by Jane Smith</p>
              <p from="Credits">Voices by John Doe</p>
            </outro>
          `,
        },
      ],
      cats: ["descendable", "control_flow"],
    },
    syntax: {
      block: true,
      atts: {},
    },
    exec: async (ctx) => {
      const inOutroContext = ctx.session.stack.some(
        (frame) => frame.blockType === "outro"
      );
      if (inOutroContext) {
        const next =
          ctx.node.kids.length > 0
            ? { node: ctx.node.kids[0] }
            : nextNode(ctx.node, ctx.session.root, false);
        return { ops: [], next };
      }
      return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    // Resume nodes are processed only when explicitly resuming, otherwise skipped
    tags: ["resume"],
    docs: {
      desc: dedent`
        Defines content that only plays when resuming a saved story. Useful for recaps, reminders,
        or re-establishing context. This content is skipped during normal story flow and only
        executes when a user returns to a saved checkpoint.
      `,
      ex: [
        {
          code: dedent`
            <resume>
              <p>Welcome back to your adventure!</p>
              <p>Last time, you had just discovered the ancient map...</p>
              <if cond="hasCompanion">
                <p>Your companion {{companionName}} is still by your side.</p>
              </if>
            </resume>
          `,
        },
        {
          code: dedent`
            <resume>
              <!-- Dynamic recap based on player progress -->
              <p>Previously in your journey...</p>
              <if cond="defeatedDragon">
                <p>You bravely defeated the dragon.</p>
              </if>
              <if cond="savedPrincess">
                <p>You rescued Princess Elena from the tower.</p>
              </if>
              <p>Now, let's continue where you left off...</p>
            </resume>
          `,
        },
      ],
      cats: ["descendable", "control_flow"],
    },
    syntax: {
      block: true,
      atts: {},
    },
    exec: async (ctx) => {
      // Check if we're in a resume context
      const inResumeContext = ctx.session.stack.some(
        (frame) => frame.blockType === "resume"
      );

      if (inResumeContext) {
        // Process children when actually resuming
        const next =
          ctx.node.kids.length > 0
            ? { node: ctx.node.kids[0] }
            : nextNode(ctx.node, ctx.session.root, false);
        return { ops: [], next };
      } else {
        // Skip resume block in normal flow
        return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
      }
    },
  },
  {
    // Blocks are only rendered if <yield>-ed to
    tags: ["block"],
    docs: {
      desc: dedent`
        Defines a reusable content block that can be invoked with \`<yield>\`. Blocks are skipped during
        normal story flow and only execute when explicitly yielded to. They can receive parameters
        from the \`<yield>\` tag, making them similar to functions in programming.
      `,
      ex: [
        {
          note: "Simple example",
          code: dedent`
            <!-- Define reusable blocks -->
            <block id="combat-round">
              <p>{{enemyName}} attacks with {{enemyWeapon}}!</p>
              <var name="damage" value="{$ Math.floor(Math.random() * 10) + enemyPower $}" />
              <p>You take {{damage}} damage!</p>
            </block>
            
            <!-- Use the block multiple times with different parameters -->
            <yield to="combat-round" enemyName="Goblin" enemyWeapon="club" enemyPower="3" />
            <yield to="combat-round" enemyName="Orc" enemyWeapon="sword" enemyPower="5" />
          `,
        },
        {
          note: "More complex logic",
          code: dedent`
            <block id="shop-transaction">
              <if cond="playerGold >= itemCost">
                <p>You purchase the {{itemName}} for {{itemCost}} gold.</p>
                <var name="playerGold" value="{$ playerGold - itemCost $}" />
                <var name="inventory" value="{$ [...inventory, itemName] $}" />
              </if>
              <else>
                <p>You don't have enough gold for the {{itemName}}.</p>
              </else>
            </block>
            
            <yield to="shop-transaction" itemName="Health Potion" itemCost="50" />
          `,
        },
      ],
      cats: ["descendable"],
    },
    syntax: {
      block: true,
      atts: {
        id: {
          type: "string",
          desc: "Unique identifier for the block, used by yield tags to invoke it",
          req: true,
        },
      },
    },
    exec: async (ctx) => {
      // Check if we're in a yield context (i.e., this block was yielded to)
      const inYieldContext =
        ctx.session.stack.length > 0 &&
        ctx.session.stack[ctx.session.stack.length - 1].blockType === "yield";

      if (inYieldContext) {
        // Process children when yielded to - treat block like a container
        const next =
          ctx.node.kids.length > 0
            ? { node: ctx.node.kids[0] }
            : nextNode(ctx.node, ctx.session.root, false);
        return { ops: [], next };
      } else {
        // Skip block in normal flow
        return { ops: [], next: skipBlock(ctx.node, ctx.session.root) };
      }
    },
  },
  {
    tags: ["yield"],
    docs: {
      desc: dedent`
        Invokes a defined \`<block>\` with optional parameters. Acts like a function call, jumping to the
        block's content with the provided parameters available as variables. After the block completes,
        execution returns to the point after the \`<yield>\` tag — or to a specified return point
        specified by the \`returnTo\` attribute.

        For examples, see \`<block>\`.
      `,
      ex: [],
      cats: ["descendable", "control_flow"],
    },
    syntax: {
      block: false,
      atts: {
        to: {
          type: "string",
          desc: "ID of the block to yield to (alias: target)",
          req: true,
        },
        return: {
          type: "string",
          desc: "ID of element to jump to after block completes (alias: returnTo)",
          req: false,
        },
        "[param]": {
          type: "string",
          desc: "Parameters passed to the block as variables",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const targetBlockId = atts.target ?? atts.to;
      const returnToNodeId = atts.returnTo ?? atts.return;
      if (!targetBlockId) {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.session.root, false),
        };
      }
      // Find the target block
      const blockResult = searchForNode(ctx.session.root, targetBlockId);
      if (!blockResult || blockResult.node.type !== "block") {
        return {
          ops: [],
          next: nextNode(ctx.node, ctx.session.root, false),
        };
      }
      // Determine return address
      let returnAddress: string;
      if (returnToNodeId) {
        const returnResult = searchForNode(ctx.session.root, returnToNodeId);
        if (returnResult) {
          returnAddress = returnResult.node.addr;
        } else {
          const next = nextNode(ctx.node, ctx.session.root, false);
          returnAddress = next?.node.addr ?? ctx.origin.addr;
        }
      } else {
        const next = nextNode(ctx.node, ctx.session.root, false);
        returnAddress = next?.node.addr ?? ctx.origin.addr;
      }
      const readableScope: { [key: string]: TSerial } = {};
      for (const [key, value] of Object.entries(
        omit(atts, "to", "return", "returnTo")
      )) {
        setState(readableScope, key, value);
      }
      ctx.session.stack.push({
        returnAddress,
        writeableScope: null,
        readableScope,
        blockType: "yield",
      });
      // Instead of jumping to the block's children, jump to the block itself
      // The block handler will need to process its children when yielded to
      return {
        ops: [],
        next: {
          node: blockResult.node,
        },
      };
    },
  },
  {
    tags: ["read"],
    docs: {
      desc: dedent`
        Reads and narrates text content from a URL or inline content.
      `,
      ex: [
        {
          code: dedent`
            <read 
              src="https://example.com/ancient-scroll.html"
              name="Scholar"
              voice="Elderly"
              volume="0.8"
            />
          `,
        },
      ],
      cats: ["media", "render"],
    },
    syntax: {
      block: true,
      atts: {
        src: {
          type: "string",
          desc: "URL to fetch text content from (aliases: href, url)",
          req: false,
        },
        from: {
          type: "string",
          desc: "Speaker/character reading the text (aliases: speaker, label)",
          req: false,
          default: "HOST",
        },
        voice: {
          type: "string",
          desc: "Voice ID to use for narration",
          req: false,
        },
        to: {
          type: "string",
          desc: "Comma-separated list of recipients",
          req: false,
          default: "PLAYER",
        },
        tags: {
          type: "string",
          desc: "Comma-separated tags for the narration",
          req: false,
        },
        volume: {
          type: "number",
          desc: "Volume level from 0.0 to 1.0",
          req: false,
        },
        background: {
          type: "boolean",
          desc: "Play narration in background",
          req: false,
          default: "false",
        },
        fadeAt: {
          type: "number",
          desc: "Start fading at this time in milliseconds",
          req: false,
        },
        fadeDuration: {
          type: "number",
          desc: "Duration of fade in milliseconds",
          req: false,
        },
        seed: {
          type: "string",
          desc: "Seed for deterministic generation (provider-specific usage)",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const url = atts.src ?? atts.href ?? atts.url;
      let raw = "";
      if (!isBlank(url) && isValidUrl(url)) {
        const { data, statusCode } = await ctx.provider.fetchUrl({
          url,
          method: toHttpMethod(atts.method ?? "GET"),
        });
        if (statusCode >= 200 && statusCode <= 299) {
          raw = data;
        }
      }
      if (isBlank(raw)) {
        raw = await renderText(await marshallText(ctx.node, ctx, ""), ctx);
      }
      if (isBlank(raw)) {
        console.warn("<read> missing content");
        return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
      }
      const blocks = extractReadableBlocks(raw);
      if (blocks.length === 0) {
        console.warn("<read> missing readable blocks");
        return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
      }
      const from = atts.from ?? atts.speaker ?? atts.label ?? HOST_ID;
      const to = atts.to ?? PLAYER_ID;
      const obs = atts.obs ? cleanSplit(atts.obs, ",") : [];
      const tags = atts.tags ? cleanSplit(atts.tags, ",") : [];
      const volume = parseNumberOrNull(atts.volume);
      const fadeAt = parseNumberOrNull(atts.fadeAt);
      const fadeDuration = parseNumberOrNull(atts.fadeDuration);
      const background = castToBoolean(atts.background);
      const ops: OP[] = [];
      for (let i = 0; i < blocks.length; i++) {
        const body = snorm(blocks[i]);
        if (isBlank(body)) {
          continue;
        }
        const event: StoryEvent = {
          node: {
            type: ctx.node.type,
            addr: ctx.node.addr,
            atts,
          },
          body,
          from,
          to,
          obs,
          tags,
          time: Date.now(),
        };
        const media = ctx.options.doGenerateAudio
          ? await ctx.provider.generateSpeech(
              {
                speaker: event.from,
                voice: atts.voice ?? event.from,
                tags: event.tags,
                body: event.body,
                pronunciations: ctx.session.pronunciations,
              },
              userVoicesAndPresetVoices(Object.values(ctx.session.voices)),
              { seed: atts.seed }
            )
          : { url: "" };
        ops.push({
          type: "play-media",
          media: media.url,
          event,
          volume,
          fadeAtMs: fadeAt,
          fadeDurationMs: fadeDuration,
          background,
        });
        recordEvent(ctx, event);
      }
      if (ops.length === 0) {
        console.warn("inject generated no events");
        return { ops: [], next: nextNode(ctx.node, ctx.session.root, false) };
      }
      return { ops, next: nextNode(ctx.node, ctx.session.root, false) };
    },
  },
  {
    tags: ["sound", "audio", "music", "speech"],
    docs: {
      desc: dedent`
        Plays audio content in the story.

        If a \`url\` attribute is given, it is played directly.

        Otherwise the prompt (inner text content) is used, and the chosen tag determines the type:
        
        - \`<sound>\` or \`<audio>\`: Sound effects
        - \`<music>\`: Music clip
        - \`<speech>\`: Text to speech (equivalent to \`<p>\` and other text tags)
        
        The output of this tag is stored in the \`_\` state variable, or the variable given by the \`key\` attribute if present.
        
        Attributes can used for volume control, fading, etc.
      `,
      ex: [
        {
          code: dedent`
            <!-- Playing from URL -->
            <sound src="https://example.com/door-creak.mp3" />
            <music url="https://example.com/theme.mp3" background="true" volume="0.5" />
            
            <!-- AI-generated audio -->
            <sound key="doorSound" duration="3000">
              A heavy wooden door creaking open slowly
            </sound>
            
            <music duration="30000" background="true" fadeAt="25000" fadeDuration="5000">
              Mysterious ambient music with ethereal strings and distant chimes
            </music>
            
            <speech voice="Sarah" from="Narrator">
              The ancient tome revealed secrets long forgotten.
            </speech>
            
            <!-- Access stored URL -->
            <p>The door sound URL is: {{doorSound}}</p>
          `,
        },
      ],
      cats: ["media"],
    },
    syntax: {
      block: true,
      atts: {
        src: {
          type: "string",
          desc: "URL of audio file to play (aliases: href, url)",
          req: false,
        },
        duration: {
          type: "number",
          desc: "Duration in milliseconds for AI-generated audio",
          req: false,
          default: "5000 for sound, 10000 for music",
        },
        prompt: {
          type: "string",
          desc: "Description for AI audio generation (aliases: make, description)",
          req: false,
        },
        background: {
          type: "boolean",
          desc: "Play audio in background without blocking story flow",
          req: false,
          default: "false",
        },
        volume: {
          type: "number",
          desc: "Volume level from 0.0 to 1.0",
          req: false,
          default: "1.0",
        },
        fadeAt: {
          type: "number",
          desc: "Start fading at this time in milliseconds",
          req: false,
        },
        fadeDuration: {
          type: "number",
          desc: "Duration of fade in milliseconds",
          req: false,
        },
        seed: {
          type: "string",
          desc: "Seed for deterministic generation (provider-specific usage)",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      let url = atts.href ?? atts.url ?? atts.src ?? "";
      const next = nextNode(ctx.node, ctx.session.root, false);
      const ops: OP[] = [];
      if (!url) {
        const rollup = await renderText(await marshallText(ctx.node, ctx), ctx);
        const prompt = (
          !isBlank(rollup) ? rollup : (atts.prompt ?? atts.description)
        ).trim();
        if (!isBlank(prompt)) {
          if (ctx.options.doGenerateAudio) {
            switch (ctx.node.type) {
              case "sound":
              case "audio":
                const audio = await ctx.provider.generateSound(
                  prompt,
                  parseNumberOrNull(atts.duration) ?? 5_000,
                  { seed: atts.seed }
                );
                url = audio.url;
                break;
              case "music":
                const music = await ctx.provider.generateMusic(
                  prompt,
                  parseNumberOrNull(atts.duration) ?? 10_000,
                  { seed: atts.seed }
                );
                url = music.url;
                break;
              case "speech":
                const voice = await ctx.provider.generateSpeech(
                  {
                    voice: atts.voice,
                    speaker: atts.from ?? atts.speaker ?? atts.voice,
                    body: prompt,
                    tags: cleanSplit(atts.tags, ","),
                    pronunciations: ctx.session.pronunciations,
                  },
                  userVoicesAndPresetVoices(Object.values(ctx.session.voices)),
                  { seed: atts.seed }
                );
                url = voice.url;
                break;
              default:
                url = "";
                break;
            }
          } else {
            url = "";
          }
        }
      }
      setState(ctx.scope, tagOutKey(atts), url);
      ops.push({
        type: "play-media",
        event: null,
        media: url,
        fadeAtMs: parseNumberOrNull(atts.fadeAt),
        fadeDurationMs: parseNumberOrNull(atts.fadeDuration),
        volume: parseNumberOrNull(atts.volume),
        background: castToBoolean(atts.background),
      });
      return {
        ops,
        next,
      };
    },
  },
  {
    tags: ["image", "img"],
    docs: {
      desc: dedent`
        Displays images in the story.

        If a \`src\`, \`href\`, or \`url\` attribute is given, it displays that image directly.

        Otherwise the prompt (inner text content) is used to generate an image using AI.
        
        The output of this tag is stored in the \`_\` state variable, or the variable given by the \`key\` attribute if present.
      `,
      ex: [
        {
          code: dedent`
            <!-- Display from URL -->
            <image src="https://example.com/castle.jpg" />
            <img url="https://example.com/portrait.png" />
            
            <!-- AI-generated images -->
            <image key="castleImg" model="google/gemini-2.5-flash-image-preview" aspectRatio="16:9">
              A majestic castle on a hilltop at sunset, fantasy art style
            </image>
            
            <img aspectRatio="1:1">
              Portrait of a wise old wizard with a long white beard
            </img>
            
            <!-- Access stored URL -->
            <p>The castle image URL is: {{castleImg}}</p>
          `,
        },
      ],
      cats: ["media"],
    },
    syntax: {
      block: true,
      atts: {
        src: {
          type: "string",
          desc: "URL of image file to display (aliases: href, url)",
          req: false,
        },
        model: {
          type: "string",
          desc: "Image generation model to use for AI-generated images",
          req: false,
        },
        aspectRatio: {
          type: "string",
          desc: "Aspect ratio for AI-generated images (e.g., '16:9', '1:1')",
          req: false,
        },
        prompt: {
          type: "string",
          desc: "Description for AI image generation (aliases: make, description)",
          req: false,
        },
        seed: {
          type: "string",
          desc: "Seed for deterministic generation (provider-specific usage)",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      let url = atts.href ?? atts.url ?? atts.src ?? "";
      const next = nextNode(ctx.node, ctx.session.root, false);
      const ops: OP[] = [];
      if (!url) {
        const rollup = await renderText(await marshallText(ctx.node, ctx), ctx);
        const prompt = (
          !isBlank(rollup) ? rollup : (atts.prompt ?? atts.description)
        ).trim();
        if (!isBlank(prompt) && ctx.options.doGenerateImage) {
          const result = await ctx.provider.generateImage(prompt, {
            model:
              (atts.model as ImageModelSlug) ??
              "google/gemini-2.5-flash-image-preview",
            aspectRatio: atts.aspectRatio as ImageAspectRatio,
            seed: atts.seed,
          });
          url = result.url;
        }
      }
      setState(ctx.scope, tagOutKey(atts), url);
      ops.push({
        type: "show-media",
        media: url,
        event: null,
      });
      return {
        ops,
        next,
      };
    },
  },
  {
    tags: INPUT_TAGS,
    docs: {
      desc: dedent`
        Pauses story execution to get input from the user.

        If the input can't be validated from attributes alone, AI will automatically be used to parse and validate the input.
        
        Raw input is stored in the \`input\` state variable. Extracted fields are stored under the \`_\` state variable, or the variable given by the \`key\` attribute if present.
        
        Note: Every \`<input>\` automatically create a story checkpoint.
      `,
      ex: [
        {
          code: dedent`
            <!-- Simple text input -->
            <input />
            <p>You said: {{input}}</p>
            
            <!-- Input with structured extraction -->
            <input
              playerName.description="The player's name"
              playerClass.description="warrior, mage, or rogue"
              playerClass.type="string"
            />
            <p>Welcome, {{playerName}} the {{playerClass}}!</p>
          `,
        },
      ],
      cats: ["dev"],
    },
    syntax: {
      block: true,
      atts: {
        id: {
          type: "string",
          desc: "Unique identifier for this input point",
          req: false,
        },
        scope: {
          type: "string",
          desc: "Set to 'global' to store extracted values in global state",
          req: false,
          default: "local",
        },
        retryMax: {
          type: "number",
          desc: "Maximum retry attempts if extraction fails",
          req: false,
          default: "3",
        },
        catch: {
          type: "string",
          desc: "ID of element to jump to if all retries fail",
          req: false,
        },
        "[field].description": {
          type: "string",
          desc: "Description for AI to extract this field from input",
          req: false,
        },
        "[field].type": {
          type: "string",
          desc: "Expected type: string, number, boolean",
          req: false,
          default: "string",
        },
        "[field].default": {
          type: "string",
          desc: "Default value if field not found in input",
          req: false,
        },
      },
    },
    exec: async (ctx) => {
      const nextAfter = nextNode(ctx.node, ctx.session.root, false);
      const atts = await renderAtts(ctx.node.atts, ctx);

      if (!ctx.session.input) {
        makeCheckpoint(ctx, []);
      }

      if (ctx.session.input && ctx.session.input.body !== null) {
        // We return to the same node when input was collected
        const { body } = ctx.session.input;
        const raw = snorm(body);

        const from = atts.from ?? PLAYER_ID;
        const to = atts.to ?? HOST_ID;

        const iev = recordEvent(ctx, {
          node: {
            type: ctx.node.type,
            addr: ctx.node.addr,
            atts,
          },
          body: raw,
          from,
          to,
          obs: cleanSplit(atts.obs, ","),
          tags: cleanSplit(atts.tags, ","),
          time: Date.now(),
        });
        iev.tags.push("input");

        const extracted: Record<string, TSerial> = {};

        const parsed = safeJsonParse(raw);
        if (parsed && typeof parsed === "object") {
          Object.assign(extracted, parsed as Record<string, TSerial>);
        } else {
          const enhanced = await extractInput(raw, atts, ctx);
          Object.assign(extracted, enhanced);
        }

        ctx.scope["input"] = raw;
        ctx.session.state["input"] = raw;
        const tkey = tagOutKey(atts);
        ctx.scope[tkey] = raw;

        if (ctx.options.verbose) {
          console.info("<input>", raw, tkey, extracted);
        }

        for (const key in extracted) {
          const subkey = `${tkey}.${key}`;
          setState(ctx.scope, subkey, extracted[key]);
          ctx.scope[key] = extracted[key];
          if (atts.scope === "global") {
            setState(ctx.session.state, subkey, extracted[key]);
          }
        }

        ctx.session.input = null;
        return { ops: [], next: nextAfter ?? null };
      }

      // If this is a *request for* input, return to the same node for handling on next advance
      return {
        ops: [
          {
            type: "get-input",
            atts,
          },
        ],
        next: { node: ctx.node },
      };
    },
  },
  {
    tags: ["log"],
    docs: {
      desc: dedent`
        Outputs debug information to the console. Useful for story development and debugging.
        Can display messages, variable values, or dump the entire current state. Only visible
        in development mode; not shown to end users.
      `,
      ex: [
        {
          code: dedent`
            <!-- Simple message logging -->
            <log message="Player reached checkpoint 3" />
            <log>Current health: {{health}}</log>
            
            <!-- Log with variable interpolation -->
            <var name="debugInfo" value="{$ JSON.stringify(inventory) $}" />
            <log message="Inventory state: {{debugInfo}}" />
          `,
        },
        {
          code: dedent`
            <!-- Dump entire state for debugging -->
            <log dump="true" />
            
            <!-- Conditional logging -->
            <if cond="verbose">
              <log message="Detailed state:" dump="true" />
            </if>
            
            <!-- Log at specific points -->
            <log>BEFORE: score={{score}}</log>
            <llm:score key="analysis" ...>{{text}}</llm:score>
            <log>AFTER: analysis={{analysis}}</log>
          `,
        },
      ],
      cats: ["dev"],
    },
    syntax: {
      block: true,
      atts: {
        message: {
          type: "string",
          desc: "Message to log. If omitted, uses inner content.",
          req: false,
        },
        dump: {
          type: "boolean",
          desc: "Dump full context including attributes, session, options, and scope",
          req: false,
          default: "false",
        },
      },
    },
    exec: async (ctx) => {
      const atts = await renderAtts(ctx.node.atts, ctx);
      const rollup = await renderText(await marshallText(ctx.node, ctx), ctx);
      const message = !isBlank(rollup) ? rollup : atts.message;
      if (message) {
        console.info(atts.message);
      }
      if (!message || atts.dump) {
        console.dir(
          {
            atts,
            session: omit(ctx.session, ["checkpoints"]),
            options: ctx.options,
            scope: ctx.scope,
          },
          {
            depth: null,
            colors: true,
          }
        );
      }
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.session.root, false),
      };
    },
  },
  {
    tags: ["macro"],
    docs: {
      desc: dedent`
        Macros allow you to create shorthand notation that expands into full story elements.

        They're processed during compilation and applied to matching patterns throughout the story content.
      `,
      ex: [
        {
          code: dedent`
            <!-- Character dialogue macro -->
            <macro match="rook">
              <rename to="p" />
              <set attr="from" value="Rook" />
              <set attr="voice" value="Clyde" />
            </macro>
            
            <!-- Usage: <rook>I've been expecting you.</rook> -->
            <!-- Becomes: <p from="Rook" voice="Clyde">I've been expecting you.</p> -->
          `,
        },
      ],
      cats: ["compile_time"],
    },
    syntax: {
      block: true,
      atts: {
        match: {
          type: "string",
          desc: "Tag name pattern to match for macro expansion",
          req: true,
        },
      },
    },
    exec: async (ctx) => {
      // This is a compile-time tag - should not be executed at runtime
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.session.root, false),
      };
    },
  },
  {
    tags: ["include"],
    docs: {
      desc: dedent`
        When the compiler sees an \`<include>\` tag, it replaces it with the content within the node
        that has the given \`id\` attribute.
      `,
      ex: [
        {
          code: dedent`
            <!-- Pre compilation -->
            <div id="stuff-to-include">  
              <p>Included content</p>
            </div>
            <div>
              <p>Some other content</p>
              <include id="stuff-to-include" />
              <p>To be continued...</p>
            </div>

            <!-- Becomes this after compilation -->
            <div>
              <p>Some other content</p>
              <p>Included content</p>
              <p>To be continued...</p>
            </div>
          `,
        },
      ],
      cats: ["compile_time"],
    },
    syntax: {
      block: false,
      atts: {
        module: {
          type: "string",
          desc: "Name of the module to include content from",
          req: true,
        },
        id: {
          type: "string",
          desc: "ID of the element within the module to include",
          req: true,
        },
      },
    },
    exec: async (ctx) => {
      // This is a compile-time tag - should not be executed at runtime
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.session.root, false),
      };
    },
  },
  {
    tags: ["end"],
    docs: {
      desc: dedent`
        Immediately ends the story. If an \`<outro>\` block exists, it will be played before ending.
        This tag provides explicit story termination points for branching narratives.
      `,
      ex: [
        {
          code: dedent`
            <!-- Simple ending -->
            <p>You have completed your quest!</p>
            <end />
            
            <!-- Conditional endings -->
            <if cond="health <= 0">
              <p>You have fallen in battle.</p>
              <end />
            </if>
            
            <!-- Multiple endings in a branching story -->
            <div id="ending-good">
              <p>You saved the kingdom!</p>
              <end />
            </div>
            
            <div id="ending-bad">
              <p>The kingdom falls into darkness.</p>
              <end />
            </div>
          `,
        },
      ],
      cats: ["control_flow"],
    },
    syntax: {
      block: false,
      atts: {},
    },
    exec: async (ctx) => {
      // Trigger the same ending logic as natural story completion
      ctx.session.loops = ctx.options.loop; // Force loop exhaustion
      ctx.session.address = null; // Clear current address
      return { ops: [], next: null }; // No next node triggers ending logic
    },
  },
  {
    tags: ["exit"],
    docs: {
      desc: dedent`
        Immediately exits the story without playing any outro. Use this for abrupt endings or 
        when you want to skip the outro entirely. Compare with \`<end />\` which plays the outro if present.
      `,
      ex: [
        {
          code: dedent`
            <!-- Immediate exit without outro -->
            <p>The spell backfires catastrophically!</p>
            <exit />
            
            <!-- Exit on failure condition -->
            <if cond="lives <= 0">
              <p>GAME OVER</p>
              <exit />
            </if>
          `,
        },
      ],
      cats: ["control_flow"],
    },
    syntax: {
      block: false,
      atts: {},
    },
    exec: async (ctx) => {
      // Mark outro as done to skip it and trigger immediate end
      ctx.session.outroed = true;
      ctx.session.loops = ctx.options.loop;
      ctx.session.address = null;
      return { ops: [], next: null };
    },
  },
  {
    tags: ["when"],
    docs: {
      desc: dedent`
        The \`<when>\` tag is a special tag used to conditionally render text content.
        
        Unlike the runtime \`<if>\` tag, which controls story flow, \`<when>\` operates only when text is being prepared to render.

        It cannot be used outside of text content tags.

        It is useful when you want to provide an LLM prompt but want to omit content until conditions are met.
      `,
      ex: [
        {
          code: dedent`
            <!-- Conditional character background in dialogue -->
            <llm:dialog from="NPC">
              You are a mysterious shopkeeper.
              <when cond="playerKnowsSecret">
                The player knows your true identity as a former wizard.
                You can hint at your magical past in your responses.
              </when>
              <when cond="!playerKnowsSecret">
                Keep your magical abilities hidden. Act like a normal merchant.
              </when>
              Respond to the player's question about magical items.
            </llm:dialog>
          `,
        },
      ],
      cats: ["compile_time", "render"],
    },
    syntax: {
      block: true,
      atts: {
        cond: {
          type: "string",
          desc: "JavaScript expression to evaluate for content inclusion",
          req: true,
        },
      },
    },
    exec: async (ctx) => {
      // This tag is processed during marshallText, not during normal execution
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.session.root, false),
      };
    },
  },
  {
    // Fallback: Any node not explicitly listed we'll skip over without visiting kids
    tags: [], // Empty array means this is the default handler
    exec: async (ctx) => {
      return {
        ops: [],
        next: nextNode(ctx.node, ctx.session.root, false),
      };
    },
  },
];
