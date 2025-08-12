### asking questions

<input>

<llm to="{questions: string[], wantsToHearDebriefAgain: boolean}">
  Convert the user's input to a list of 0 or more condensed and refined questions.
  If they said something like "nope" or "no questions", return an empty array.
  If they indicate something like "can i hear the debrief again" or "can you explain it again" mark wantsToHearDebriefAgain to `true`.
  User input: {{input}}
</llm>

<go to="hear debrief" if="wantsToHearDebriefAgain">

<go to="no-more-questions" if="len(questions) < 1">

<llm>
  {{robert_llm}}
  Speaking as Robert, in a brief single paragraph, please answer the player's question(s): {{questions}}
  For context, here is what you already told the player: {{debriefing_main}}
  You also have additional information you did *not* tell the player: {{debriefing_hidden}}
  You can share any information from either of these. Don't give away everything - only answer what is asked. Make the player dig.
  For any question unrelated to this mission, indicate it's not relevant and tell the player to stay on topic.
</llm>

Robert: {{_}}

Robert: What else? | Anything else? | Any other questions?

<go to="asking questions">

### no more questions

Robert: Great. In that case, good luck. We're counting on you.

<go to="before the date">
