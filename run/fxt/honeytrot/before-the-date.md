# before the date

It's Friday night. Shortly you're going to meet Steven Warner. You're nervous, but prepared. After all, it's only 9 words - how hard could it be? The final question is to decide what to wear. You stand in front of your wardrobe - there are many options. Please describe what you'll wear to your date with Steven.

<input with="llm" to="{myOutfit: string, llmOutfitOpinion: string}" limit="10000">
  The user has chosen their outfit - there may be some mistakes and it may be long or confusing.
  Please shorten what they said into a clear, concise description of their outfit as `myOutfit`.
  Also give a single word adjective describing your opinion of the outfit as `llmOutfitOpinion`. (e.g. classy, sexy, ridiculous...)
  If the user didn't give an answer just use "a simple black top, jeans, and nice sneakers".
  {{input}}
</input>

You get dressed. Wearing your {{llmOutfitOpinion}} outfit - {{myOutfit}} - you head out to your date.

<go to="the date">
