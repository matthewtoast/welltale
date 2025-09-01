// TODO: Express HTTP server that hosts the story runner. Intended to run locally. Has access to disk.
//
// use yargs to get CLI options from here. always camelCase options. there is a built-in way to force yargs to do this
// accept a port in args
//
// When started up...
// Exposes an HTTP endpoint that accepts a JSON payload containing
// storyId - string - id of the story we're playing
// playthru - Playthru - JSON of a Playthru object
// options - StoryOptions - Json of StoryOptions object
//
// when called the server
// validates the inputs using Zod Types - (please define these alongside the real types, not here)
// creates a ServiceProvider which can load cartridges from disk
// loads the Story Cartridge from local disk
//.   - first try this dir, and the __dirname/../test/fixtures dir
//.   - then try ~/.welltale/cartridges/*
//
// for API keys, use passed-in command line options for things like elevenlabs api key, openai key, etc.
//
// when we receive a payload we get all the stuff together,
// invoke advanceStory, then return the result payload JSON
