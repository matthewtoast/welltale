# Welltale Story Engine Tutorial

Welcome to the Welltale tutorial! This interactive story demonstrates the core features of the framework. Let's explore how to build dynamic, branching narratives with conditional logic, user input, and reusable components.

## Getting Started

👋 Hello! I'm your guide through this tutorial. Let's start by learning about user input and variables.

### Collecting User Input

Stories can gather input from users and store it in variables for later use. Enter your name:

<input to="userName" as="string" />

Great! Nice to meet you, **{{userName}}**!

Now let's try collecting a number:

<input to="favoriteNumber" as="number" />

Perfect! You entered **{{favoriteNumber}}**. We'll use these variables throughout the tutorial.

## Conditional Branching

One of the most powerful features is conditional branching. Let's create different paths based on your favorite number:

<if cond="favoriteNumber > 10">
  <if cond="favoriteNumber == 42">
    <jump to="easter egg" />
    <else>
      <jump to="big number path" />
    </else>
  </if>
  <else>
    <jump to="small number path" />
  </else>
</if>

## big number path

Wow, {{userName}}! You like big numbers! Your favorite number {{favoriteNumber}} is greater than 10.

<jump to="variable manipulation" />

## small number path

Interesting choice, {{userName}}! Your favorite number {{favoriteNumber}} is 10 or less. Sometimes the best things come in small packages!

<jump to="variable manipulation" />

## easter egg

🎉 **Achievement Unlocked!** You found the answer to life, the universe, and everything!

## variable manipulation

### Working with Variables

Let's do some calculations with your number:

<set key="doubled" value="favoriteNumber * 2" />
<set key="squared" value="favoriteNumber * favoriteNumber" />

- Your number doubled: **{{doubled}}**
- Your number squared: **{{squared}}**

You can also use multi-line expressions for complex calculations:

```
magicNumber = favoriteNumber + userName.length
isLucky = magicNumber % 7 == 0
luckyMessage = isLucky ? "You're lucky!" : "Maybe next time!"
```

Your magic number is **{{magicNumber}}**. {{luckyMessage}}

## Timing and Pacing

Stories can control pacing with sleep commands. Let's take a brief pause...

<sleep duration="1000" />

⏰ That was a 1-second pause! Use these to create dramatic effect or give readers time to absorb information.

## Reusable Content with Blocks and Yields

### Understanding Blocks

Blocks are reusable sections of content that can be called from multiple places in your story. Think of them as subroutines or functions. Here's how they work:

Let's call a reusable greeting:

<yield to="tutorial greeting" />

Welcome back! As you can see, we just jumped to a block and returned here automatically.

Now let's call a calculation block:

<yield to="calculation demo" />

### Advanced Block Usage

Blocks become even more powerful when you need to control where execution continues after the block completes:

<yield to="tutorial greeting" returnTo="custom return point" />

This text will be skipped because we're using a custom return point...

## custom return point

Perfect! By using `returnTo`, we controlled exactly where the story continued after the block.

### Multiple Dialogues

One common use case for blocks is creating reusable dialogue that maintains context:

<yield to="friendly npc" />

<set key="playerMood" value="'happy'" />

Let's talk to them again with our new mood:

<yield to="friendly npc" />

<jump to="loops and navigation" />

<!-- Define reusable blocks at the end of the file -->
<block id="tutorial greeting">
  ### 📦 Inside a Reusable Block!
  
  Hi {{userName}}! This greeting can be called from anywhere in the story.
  
  Your favorite number is still {{favoriteNumber}}, proving that blocks have access to all story variables.
</block>

<block id="calculation demo">
  ### 🧮 Calculation Block
  
  Let's create some computed values:
  
  <set key="blockComputed" value="favoriteNumber * 10 + userName.length" />
  
  In this block, we calculated: {{favoriteNumber}} × 10 + length of "{{userName}}" = **{{blockComputed}}**
</block>

<block id="friendly npc">
  ### 🤖 Friendly NPC Dialogue
  
  <if cond="!playerMood">
    "Hello there, {{userName}}! I haven't seen you before. How are you feeling?"
    <else>
      "Oh, you're back! I can see you're feeling {{playerMood}}. That's wonderful!"
    </else>
  </if>
</block>

## loops and navigation

### Navigation Patterns

You can create loops and complex navigation patterns. Here's a simple menu system:

## main menu

### 📋 Main Menu

What would you like to learn about?

1. Type "variables" to review variable features
2. Type "blocks" to see blocks again
3. Type "random" to explore randomness
4. Type "done" to finish the tutorial

<input to="menuChoice" as="string" />

<if cond="menuChoice == 'variables'">
  <jump to="variable manipulation" />
  <else>
    <if cond="menuChoice == 'blocks'">
      <yield to="tutorial greeting" />
      <jump to="main menu" />
      <else>
        <if cond="menuChoice == 'random'">
          <jump to="randomness demo" />
          <else>
            <if cond="menuChoice == 'done'">
              <jump to="conclusion" />
              <else>
                I didn't understand "{{menuChoice}}". Let's try again!
                <jump to="main menu" />
              </else>
            </if>
          </else>
        </if>
      </else>
    </if>
  </else>
</if>

## randomness demo

### 🎲 Random Number Generation

The engine supports various random functions:

```
diceRoll = dice(6)
coinFlip = coinToss(0.5) ? "Heads" : "Tails"
randomPercent = randInt(1, 100)
```

- Dice roll (1-6): **{{diceRoll}}**
- Coin flip: **{{coinFlip}}**
- Random percentage: **{{randomPercent}}%**

<jump to="main menu" />

## conclusion

### 🎉 Tutorial Complete!

Congratulations {{userName}}! You've learned:

✅ **User Input** - Collecting strings and numbers
✅ **Variables** - Storing and manipulating data  
✅ **Conditionals** - Creating branching paths
✅ **Expressions** - Complex calculations
✅ **Blocks & Yields** - Reusable content sections
✅ **Navigation** - Jumps and controlled flow
✅ **Randomness** - Dynamic content generation

Your journey stats:

- Favorite number: {{favoriteNumber}}
- Magic number: {{magicNumber}}
- Computed value: {{blockComputed}}

### Next Steps

Now you're ready to create your own interactive stories with Welltale! Check out the documentation for more advanced features like:

- Audio generation and playback
- State persistence and save games
- Custom functions and extensions
- Multi-file story organization

Happy storytelling! 🚀
