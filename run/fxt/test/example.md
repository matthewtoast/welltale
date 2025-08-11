---
front: matter
can: be used
for: metadata
and: other things
---

<!-- single line -->

ABC!

<!--
Comment
Anything not under an explicit heading is global inscope
-->

# This is a scene

Scenes are processed stanza by stanza.

{%
assign name = "Alex"
%}

```
/*
  Code blocks for JavaScript scripting
*/
var x = 12
name // Alex
game.Scene.name // Alex
```

Alex: My name is {{name}} and I am {{x}} years old.

Host: The host can act as narrator, explainer, etc.

Not explicitly labeled text is assumed to be spoken by the host.

> Blockquotes contain instructions for the LLM not seen by the end user.
> They can go to multiple lines and use **formatting** for emphasis
>
> # including headings
>
> Anything in block quotes is ok!

What happens if we get here without a decision?

## This is a subscene

This inherits vars from the scope of [This is a scene](#this-is-a-scene).

<script>
  // You can use script tags too if you want
  console.log(x) // Reassign from above
  var product = { type: 'shirt' }
</script>

{% case product.type %}
{% when 'shirt' %}
This is a shirt
{% when 'pants' %}
These are pants
{% else %}
Something else
{% endcase %}

<!--
The main thing I need to be able to do here is account for the concepts of Entity, Component, Relation
And Entity have core subclasses for Actor, Place, Thing which need to be able to be defined
-->

- Hello
  1. There
  - How
  - Are
  - You
  2. Now
- What is going
- On
  - With you
