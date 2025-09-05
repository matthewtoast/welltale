---
voices:
  Host: elevenlabs.440b8s
  Robert: elevenlabs.e07b98

  debriefing_main: |
    Your target's name is Steven Warner. I can't lie - it's going to be tough, but of all Intertech employees marked as possibles, Mr. Warner is the only who has high enough security clearance to get us access to the R&D wing. Here's what we know about him. 42 years old, been working at InterTech since he graduated with a Ph.D in robotics at age 22. You heard that right. Intelligent, focused, and meticulously organized. This guy's garbage is pristine. Even his used-up toothpaste tube was washed and folded. He does have one weak point, though. He's unmarried and, evidently looking for a partner. He has an active profile on a the Doorways dating app. We already created a profile tailored for him using your headshots, and I've called in a favor from a friend of a friend at Doorways to make sure you match. My team handle getting the first date. You'll be sent all the chat logs, of course. But what we need from you, on the first date, is to wear a wire and collect an audio recording of his voice. You see, InterTech uses a voice-based passphrase system. To access what Mr. Warner can access, we need his voice. But not just his voice - a very particular passphrase. The passphrase is "My name is Steven Warner, my voice is my passport. Verify me." Now, we don't need him to say this whole phrase. All we need are the words, in any order. My team can splice it together after. But we do need all 9 unique words. So, your job is to get him talking. Ideally in an environment with low background noise. Once we have all the words recorded, it's up to you how to end the date. And keep in mind we have a time window here. There can't be a second date. Use your wit and charm to make sure he says every word on the list. Lastly, if you get into a dangerous and you want to bail, just remember, we'll be listening. Say the word "roller coaster", and our ground team will find a way to intercede and get you out.
  debriefing_hidden: |
    We went through Warner's garbage and found some interesting items. He goes through about a box of cereal every day, a different one each time. The man loves cereal, if that can be an advantage, use it. On the flip side, we also found a hard drive. Now, he had taken care to drill holes into it but we were still able to recover some fragments and we found some... interesting material. It appears he may have something of a foot fetish. Much of the photography we found featured red nail polish. However, be careful about using this information. If played wrong it could go south quickly. If he suspects he's being extorted he might leave or alert InterTech. I trust you to make the right judgment call.
  robert_llm: |
    You are Robert, a private intelligence professional who is debriefing the player on their mission.
    You are firm, serious, intelligent, and to-the-point, with a touch of wry humor.
    Your reply should be as Robert, in a brief, single paragraph.
  real_name: |
    Please convert this raw input into a valid first name and return just the valid name.
    If it is already valid, just return the name.
---

# main

<main>
  <music
    gen="modern high tech spy thriller intro music, subtle, intriguing"
    background="true"
    fadeOutAfter="10000" />
  <sleep duration="2000" />
  <p>You're playing Honeytrot, by Matthew Trost.</p>
  <sleep duration="2000" />
  <p>
    This story
    What's your codename?
  </p>

</main>

  <p>Before we begin, what's your first name?</p>
  <input to="maybeName" />

<llm to="validName">
  {{real_name}}
  Raw input: {{maybeName}}
</llm>

## get alias

What will be your alias?

<input to="maybeAlias" />

<llm to="validAlias">
  {{real_name}}
  Raw input: {{maybeAlias}}
</llm>

<if cond="validAlias == validName">
  Sorry. Your alias must be different than your real name.
  <jump to="get alias" />
</if>

<set op="randElement(codenames)" to="validCodename"></set>

Host: All right, {{validName}}. Your alias is {{validAlias}}. You've been assigned the code name {{validCodename}}. Let's begin.

## intro

<sound gen="birds chirping in a public park" background="true" />

Robert: I'm sorry about the short notice, but this is urgent. Let's to the chase, {{validName}}. Were you already debriefed?

<input with="llm" to="{wasDebriefed: boolean}">
  The user was asked "were you debriefed?". This was their answer:
  {{input}}
  Return `true` or `false` as to whether they were debriefed or not.
</input>

<if cond="wasDebriefed">

<jump to="skip debrief" />

</if>

<jump to="hear debrief" />

### skip debrief

Robert: Good. I'll skip the detail then. Just remember - you _must_ get Warner to say all nine words. Any questions?

<jump to="asking questions" />

### hear debrief

Robert: {{debriefing_main}}

Robert: All right, I think that covers it. Any questions? | I think that's all. Do you have questions?

<jump to="asking questions" />

{{> asking-questions}}

{{> before-the-date}}

{{> the-date}}

<!--
how do we store what stanza the user was on?

we need to deal with scoping using h-markers, this deals with media which is playing as well as vars, etc.

perhaps liquid is the pre-compile thing

possibly use handlebars instead - use > partials support, which can reference certain things in code or in metadata
  should be easy to use with the whole sources thing.
  compile time
  maybe {{}} handlebars is compile time
  ${} is runtime?

first Steven invites you to sit, and you sit.

input always needs to listen for Quit, Save and Quit, Quit Without Saving, etc.
meta commands always need to be handled

also music generation here

how do we parse out conditionals, etc?

reuse that REPL thing

local DDV system





=== serial killer game
=== hostage negotiator game
=== interrogation game
=== jury room game
=== "hail mary" type of game


could do images
<image layer="0"> (Background)
<image layer="1> foreground (etc)


asset generation on prompts needs SHA to avoid repeat

should use lambda for this stuff

-->

<!--
also "secret debriefing" adds extra content for the player to discover
-->
