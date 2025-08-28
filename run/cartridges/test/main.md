# main

This is a test.

## get number

Enter a number.

<input to="someNumber" as="number" />

You entered {{someNumber}}.

<if cond="someNumber > 5">
  <if cond="someNumber == 666">
    <jump to="mark of the beast" />
    <else>
      <jump to="bigger than 5" />
    </else>
  </if>
  <else>
    <jump to="5 or less" />
  </else>
</if>

## in any case

In any case...

<jump to="more input" />

## bigger than 5

BIGGER than 5! WOW!

<jump to="in any case" />

## 5 or less

LESS than 5... Interesting...

## more input

<jump to="get number" />

## mark of the beast

OH NO! MARK OF THE BEAST! SECRET DOOR!

## variable tests

<set key="total" value="someNumber * 2" />

The total is {{total}}.

```
score = total + 10
bonus = score > 50 ? 100 : 0
```

Your score is {{score}} with a bonus of {{bonus}}.

<sleep duration=1000 />

Nice sleepy time that 'twas!
