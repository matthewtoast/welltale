# welltale

Welltale is an interactive audio story platform. Think Audible, but interactive. It consists of:

- An XML-based DSL for authoring stories that is both easy for humans to write and machines to read
  - See fic/honeytrot/main.xml for an example
- A platform-agnostic story engine that compiles and executes said DSL's story files
  - See lib/StoryCompiler.ts and lib/StoryEngine.ts
- A simple REPL tool and story auto-runner for the engine developer to test stories
  - See lib/repl.ts and lib/auto.ts

It will soon also comprise:

- A web app to browsing, purchasing, and play stories
  - See web/ for code, sst.config.ts for deployment, and jobs/ for background tasks
- An author portal to upload and monetize stories (same codebase as web app)
- An iOS app for browsing, purchasing, and playing stories
  - See ios/ for iOS application code

Stories may short, long, or even "infinite". Their interactivity affordances may be anything from explicit user prompts, to subtlely included dynamic data from the user's environment, to full-on dialog with NPCs.

With LLMs, whole new types of stories are now possible that authors and creators have barely scratched the surface of. By constraining to the problem of audio, we can also unglue peoples eyes from their phones and bring back human imagination.
