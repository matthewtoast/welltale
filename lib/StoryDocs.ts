export interface TemplateSyntaxDoc {
  syntax: string;
  desc: string;
  examples: { code: string; note?: string }[];
}

export const TEMPLATE_SYNTAX: TemplateSyntaxDoc[] = [
  {
    syntax: "{{variable}}",
    desc: "Insert state variable values into your text using Handlebars-like syntax. Variables may be strings, numbers, or booleans.",
    examples: [
      {
        code: `<var name="playerName" value="Alex" />
<p>Welcome, {{playerName}}!</p>`,
        note: "Plays: Welcome, Alex!",
      },
      {
        code: `<input name.description="your character's name" />
<p>Hello {{name}}, ready for adventure?</p>`,
        note: "Uses the name entered by the user",
      },
    ],
  },
  {
    syntax: "{$ expression $}",
    desc: "Evaluate JavaScript expressions and insert the result. You can do math, call functions, or create logic.",
    examples: [
      {
        code: `<var name="health" value="80" type="number" />
<var name="maxHealth" value="100" type="number" />
<p>Health: {$ health $}/{$ maxHealth $} ({$ Math.round(health/maxHealth * 100) $}%)</p>`,
        note: "Plays: Health: 80/100 (80%)",
      },
      {
        code: `<var name="inventory" value="{$ ['sword', 'shield', 'potion'] $}" />
<p>You have {$ inventory.length $} items: {$ inventory.join(', ') $}</p>`,
        note: "Plays: You have 3 items: sword, shield, potion",
      },
      {
        code: `<p>It's {$ new Date().getHours() < 12 ? 'morning' : 'afternoon' $}!</p>`,
        note: "Plays different text based on current time",
      },
    ],
  },
  {
    syntax: "[[random|variations]]",
    desc: "Create dynamic text variations that change each time they're encountered. Use pipe symbols to separate options. Add ^ for cycling through options in order, or ~ for shuffled rotation.",
    examples: [
      {
        code: `<p>The weather is [[sunny|cloudy|rainy|stormy]] today.</p>`,
        note: "Randomly selects one weather option each time",
      },
      {
        code: `<p>Day [[^1|2|3|4|5]]: The adventure continues...</p>`,
        note: "Cycles through days in order: 1, 2, 3, 4, 5, 1, 2...",
      },
      {
        code: `<p>You hear [[~a distant roar|footsteps echoing|wind whistling|branches creaking]].</p>`,
        note: "Shuffles all sounds, plays each once before reshuffling",
      },
      {
        code: `<var name="playerClass" value="warrior" />
<p>As a {{playerClass}}, you [[feel confident|steel yourself|prepare for battle]].</p>`,
        note: "Variations can be used with other template syntax",
      },
    ],
  },
  {
    syntax: "{% prompt %}",
    desc: "Generate text using AI based on your prompt. The AI creates content that fits naturally into your story.",
    examples: [
      {
        code: `<p>{% Describe the eerie atmosphere of an abandoned castle at midnight %}</p>`,
        note: "AI generates atmospheric description",
      },
      {
        code: `<var name="location" value="forest" />
<p>You can hear the sound of {% Create a mysterious sound effect description for a {{location}} setting %}</p>`,
        note: "AI generates description using the location variable",
      },
      {
        code: `<var name="health" value="20" type="number" />
<p>"{% Describe how a character feels, in the first person, when their health is {$ health $} out of 100 %}", he said.</p>`,
        note: "AI uses calculated values in the description",
      },
    ],
  },
  //   {
  //     syntax: "Attribute values",
  //     desc: "Most tag attributes can use variables and expressions, not just the content inside tags.",
  //     examples: [
  //       {
  //         code: `<var name="npcName" value="Wizard" />
  // <var name="npcVoice" value="Merlin" />
  // <p from="{{npcName}}" voice="{{npcVoice}}">Welcome to my tower!</p>`,
  //         note: "The speaker and voice are determined by variables",
  //       },
  //       {
  //         code: `<var name="volume" value="0.8" type="number" />
  // <sound volume="{$ volume * 0.5 $}">Thunder rumbling in distance</sound>`,
  //         note: "Volume is calculated from a variable",
  //       },
  //     ],
  //   },
  {
    syntax: "Pattern processing order - important",
    desc: "Templates are processed in this specific order: (1) {{variables}} first, (2) {$ expressions $} second, (3) [[random|variations]] third, (4) {% AI prompts %} last. Later patterns can use results from earlier ones.",
    examples: [
      {
        code: `<var name="playerClass" value="warrior" />
<var name="strength" value="15" type="number" />
<p>{% Describe a {{playerClass}} with {$ strength $} strength points [[charging into battle|preparing for combat]] %}</p>`,
        note: "Variables → expressions → variations → AI generation",
      },
      {
        code: `<var name="weather" value="stormy" />
<p>The {{weather}} night is [[eerily quiet|full of tension]] as {% describe the mood when it's {$ weather === 'stormy' ? 'very dark' : 'peaceful' $} %}</p>`,
        note: "Each template type builds on the previous ones in order",
      },
    ],
  },
];
