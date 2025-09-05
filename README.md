# welltale

Welltale is an interactive audiobook platform. It consists of:

1. A mobile app for browsing, purchasing, downloading, and listening to stories (interactive audiobooks)
2. A web app for authors to upload their stories and share for free or sell
3. An HTTP server and related APIs for accounts, profiles, title search, purchases, etc.
4. An XML-based DSL for authoring stories that is both easy for humans to write and machines to read
5. A story engine that compiles and executes said DSL's story files
6. An HTTP server that hosts said engine, running each story beat in coordination with clients
7. A desktop app and accompanying CLI tool for authors to locally run and test their stories

## Overview

Think of Welltale like Audible - a place to find audio books, audio podcasts, and "radio play"-like content - except, unlike Audible, stories are _interactive_.

With stories on Welltale, the listener can give input and affect the outcome. Stories may short, long, or even "infinite". Their interactivity can be anything from explicitly prompting the user to make decisions in the first-person, to letting the user suggest what the hero might do, to having dialog with NPCs, and more.

Welltale stories aren't recordings. Instead, they're driven by we'll call cartridges. Cartridges are folders or ZIP files containing XML files. These files contain all of the the story's contents and gameplay logic.

## Data Model & Story Flow

The main object in Welltale is the story. Each story has a title, a description, reviews and comments. The actual content for the story is contained in the cartridge. Stories can be in draft or published status. Stories can be free or paid. If paid, the author can earn money from purchases.

A story may have multiple cartridges - in case of version updates - but there is always exactly one primary cartridge at a time.

When a user plays a Welltale story, all of their inputs and any resulting state changes are recorded in an object called the _session_. The playback instance is an association between the cartridge, the user, and the user's inputs for that particular playback. A user might start a separate playback instance of the same story (cartridge) if they want.
