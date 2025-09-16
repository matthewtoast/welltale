import { autoFindVoice } from "lib/ElevenLabsUtils";
import { ELEVENLABS_PRESET_VOICES } from "lib/ElevenLabsVoices";
import { expect } from "./TestUtils";

expect(
  autoFindVoice(
    {
      speaker: "Clyde",
      voice: "Clyde",
      tags: [],
    },
    ELEVENLABS_PRESET_VOICES
  ),
  "2EiwWnXFnvU5JabPnv8n"
);

expect(
  autoFindVoice(
    {
      speaker: "Clyde",
      voice: "Clyde",
      tags: [],
    },
    ELEVENLABS_PRESET_VOICES
  ),
  "2EiwWnXFnvU5JabPnv8n"
);

expect(
  autoFindVoice(
    {
      speaker: "HOST",
      voice: "",
      tags: [],
    },
    ELEVENLABS_PRESET_VOICES
  ),
  "pNInz6obpgDQGcFmaJgB"
);
