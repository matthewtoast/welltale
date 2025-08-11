---
voices:
  Robert: elevenlabs.e07b98
content:
  debriefing: |
    Your target's name is Steven Warner. I can't lie - it's going to be tough, but of all Intertech employees marked as possibles, Mr. Barndes is the only who has high enough security clearance to get us access to the R&D wing. Here's what we know about him. 42 years old, been working at InterTech since he graduated with a Ph.D in robotics at age 22. You heard that right. Intelligent, focused, and meticulously organized. This guy's garbage is pristine. Even his used-up toothpaste tube was washed and folded. He does have one weak point, though. He's unmarried and, evidently looking for a partner. He has an active profile on a the Doorways dating app. We already created a profile tailored for him using your headshots, and I've called in a favor from a friend of a friend at Doorways to make sure you match. My team handle getting the first date. You'll be sent all the chat logs, of course. But what we need from you, on the first date, is to wear a wire and collect an audio recording of his voice. You see, InterTech uses a voice-based passphrase system. To access what Mr. Warner can access, we need his voice. But not just his voice - a very particular passphrase. The passphrase is "My name is Steven Warner, my voice is my passport. Verify me." Now, we don't need him to say this whole phrase. All we need are the words, in any order. My team can splice it together after. But we do need all 9 unique words. So, your job is to get him talking. Ideally in an environment with low background noise. Once we have all the words recorded, it's up to you how to end the date. And keep in mind we have a time window here. There can't be a second date. Use your wit and charm to make sure he says every word on the list. Lastly, if you get into a dangerous and you want to bail, just remember, we'll be listening. Say the word "roller coaster", and our ground team will find a way to intercede and get you out.
  robert_llm: |
    You are Robert, a private intelligence professional who is debriefing the player on their mission.
    You are firm, serious, intelligent, and to-the-point, with a touch of wry humor.
    Your reply should be as Robert, in a brief, single paragraph.
---

# main

<!--
code name
real name
alias

user can make a mistake and say their wrong name


also "secret debriefing" adds extra content for the player to discover
-->

Host: You're playing Honeytrot, by Matthew Trost. Before we begin, what's your name?

<input to="maybeName">

<llm to="validName">
  Please convert this raw input into a valid first name and return just the valid name.
  If it is already valid, just return the name.
  Raw input: {{maybeName}}
</llm>

Host: All right, {{validName}}. Let's begin.

<jump to="intro">

## intro

<gen-audio prompt="birds chirping in a public park" to="url">

<play-audio url="{{url}}" background="true">

Robert: Let's to the chase, {{validName}}. Were you already debriefed?

<input>

{wasDebriefed: boolean} = {
The user was asked "were you debriefed?". This was their answer:
{{input}}
Return `true` or `false`.
}

<jump to="skip debrief" if="wasDebriefed">
<jump to="hear debrief">

### skip debrief

Robert: Good. I'll skip the detail then. Just remember - you must get Warner to say all nine words. Any questions?

<jump to="any questions">

### hear debrief

Robert: {{debriefing}} All right, I think that covers it. We're counting on you. Any questions?

<jump to="any questions">

### any questions

<input>

{questions: string[]} = {
Convert the user's input to a list of 0 or more questions.
If they said something like "nope" or "no questions", return an empty array.
User input: {{input}}
}

<jump to="no-more-questions" if="length(questions) < 1">

<llm>
  Speaking as Robert, in a brief single paragraph, please answer the player's question(s): {{questions}}
  For context, here is what you already told the player: {{debriefing}}
  For any question unrelated to this mission, indicate it's not relevant and to stay on topic.
</llm>

Robert: {{_}}

Robert: What else? | Anything else? | Any other questions?

<jump to="any questions">

### no more questions

Robert: Great. In that case, good luck. We're counting on you!

<jump to="the date">

## the date

<gen-audio prompt="the din of a Chinese restaurant" to="url">

<play-audio url="{{url}}" background="true">

It's 5:55pm on Friday night. You just arrived at the Kong Sihk Tong restaurant. Your date with Steven was scheduled for 6, but of course Steven is already here and seated. Steven is balding but not unhansome, however his brown out-of-fashion suit and poor posture decrease his romantic marketability. He doesn't seem to notice you approaching - probably because he's busy putting contact drops into his eyes. A strange feeling of sympathy for this evidently lonely, innocent man hits you as you observe him - but you try to shake it off, remembering your objective. You stand at the table and say...:

<input timer="5s">

<!--
if no answer, he notices you
-->

<!--
consistent syntax or more options to do same thing?

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
