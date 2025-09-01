// TODO: Server that hosts the story runner. Intended to run on AWS lambda. Has no access to disk.
// for storage of stories we will use S3.

// When started up...
// accepts a JSON payload containing
// storyId - string - id of the story we're playing
// playthru - Playthru - JSON of a Playthru object
// options - StoryOptions - Json of StoryOptions object
//
// when called the server
// validates the inputs using Zod Types - (please define these alongside the real types, not here)
// creates a ServiceProvider which can load story cartridges from S3 based on id.
// the AWS_BUCKET should be an env var available, that is where cartridges will be stored
// they will be stored like {bucket}/cartridges/{storyId}.zip
// download the zip, unzip it into the Cartridge data format
//
// for API keys, assume defined in env vars.
// set up a pre-validation to check for existence of all env vars and throw if not present
//
// when we receive a JSON payload we get all the stuff together into proper objects,
// invoke advanceStory, then return the result payload JSON
