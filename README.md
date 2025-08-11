# welltale

Welltale is an iOS app for interactive audio stories.

## Overview

Think of Welltale like Audible, but exclusively for interactive audio books, audio podcasts, and "radio play"-like content. That is, audio stories where the user has the ability to give input and affect the outcome. Stories might be short, long, or even "infinite" - and are interactive in myriad ways.

Unlike Audible, Welltale stories aren't recordings. Instead, they're driven by we'll call cartridges, .zip files containing (usually text) assets such as prompts, character descriptions, narrative trees, and scripts that control the story. These files are used as context for an AI backend that orchestrates the story playback on the fly, as the player listens and interacts.

Stories are created by members of the community and can range from very linear to very branching. In some stories, the player (i.e. listener) may take on the role of a character in the first person. In others, they may act as the narrator. In still others, they may simply listen and find that the weather in their local area seems to be affecting the outcome.

## Basic Data Model

The fundamental object in Welltale is the story. A story has a title, a description, maybe a thumbnail image, reviews and comments. But the actual content for the story is contained in the cartridge. Stories can be in draft or published status. Stories can be free or paid. If paid, the author can earn money from purchases.

A story may have multiple cartridges - in case of version updates - but always at least one, and only one primary/default cartridge at a time. If a player starts a story from a particular cartridge they may want to remain on that one rather than continue with the upgraded one the author published.

When a user plays a Welltale story, a playback instance gets created. The playback instance is an association between the cartridge, the user, and the user's inputs for that particular playback. A user might start a separate playback instance of the same story (cartridge) if they want.

## Story Flow

Stories are made up of a sequence of beats. Beats can be input beats or output beats. An input beat is some input from the user. An output beat is what contains the actual content the user listens to.

Each story beat has a parent id, allowing beats to branch. For example, a user may regret a particular choice and rewind to a particular beat to give different input. Beats are like paragraphs (or "messages" in LLM parlance).

Beats consist of an array of structured data objects called chunks. If beats are paragraphs, chunks are sentences. A chunk has data describing the actual input or output - in the typical case, who said what. Chunk types may represent:

- A sentence of the story spoken by the narrator
- A line of dialog spoken by a character
- A line of text representing the user's choice of where to go next with the story
- A sound effect - e.g. birds chirping - which begins playing and stops only when a certain point is reached
- A command informing the client to pause and wait for input before proceeding
- A marker indicating the end of the story
- And more

## Payment & Billing

The app is free to download and use. New users can listen to up to 1 hour's worth of stories for free. After that, they must enroll in a paid monthly plan. There are three paid plans: for 1 hour a day, 2 hours a day, and 6 hours a day. All of these plans have the option to continue listening at a certain price per minute. The higher the plan the less you pay per minute during the alloted time frame.

Payments are handled with Apple Pay and, if further payment options become necessary, Stripe.

## Game Loop

The main game loop works as follows:

1. Client collects user input.
2. Client sends user input to server.
3. Server stores input as chunks in an input beat.
4. Server creates output beat container; sends beat id to client.
5. Client begins polling next output beat (static file) for chunks.
6. (Server starts job to generate chunks for the given output beat.)
7. Client renders each chunks as it is received, until some kind of end or await-input chunk is reached.
8. Goto 1.

## Creating Stories

Story cartridges are .zip files with at least one file inside: a main.yml. This contains metadata and instructions for executing the story flow. The main.yml may contain macros and DSL scripts to automatically handle certain action or load external files. The minimal story is just a prompt, and the LLM will handle the rest.

--TK-- Author need a way to test their stories. How can we give them the ability to do this cheaply.
--TK-- Do they do it in the app itself and write into fields? Feels unweildy
--TK-- A whole "For Creators" portal is necessary or something? Could just use Inform "plus"
--TK-- Need to read more about Inform

## Publishing Stories

When using the main app:

1. Explore stories
2. Create & sell stories
3. Listen to others' playthrough

### Affordances

Users who don't feel like interacting can toggle "Decide For Me" mode which will automatically input as necessary, at which point they will basically just have a normal audio book.
