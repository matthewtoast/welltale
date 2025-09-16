import { autoFindVoice } from "lib/ElevenLabsUtils";
import { ELEVENLABS_PRESET_VOICES } from "lib/ElevenLabsVoices";
import { expect } from "./TestUtils";

expect(
  autoFindVoice(
    {
      speaker: "Clyde",
      voice: "",
      tags: [],
    },
    ELEVENLABS_PRESET_VOICES
  ),
  ""
);
