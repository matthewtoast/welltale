# main

This is a test.

Enter a number.

<input to="someNumber" as="number" />

You entered {{someNumber}}.

<if cond="someNumber > 5">
  <jump to="bigger than 5">
</if>

## 5 or less

LESS than 5... Interesting...

## in any case

In any case...

<jump to="more input">

## bigger than 5

BIGGER than 5! WOW!

<jump to="in any case">

## more input

We'll get more input here
