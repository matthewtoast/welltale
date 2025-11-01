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
