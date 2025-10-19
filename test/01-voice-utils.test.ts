import { autoFindVoiceId } from "../lib/ElevenLabsUtils";
import { ELEVENLABS_PRESET_VOICES } from "../lib/ElevenLabsVoices";
import { expect } from "./TestUtils";

expect(
  autoFindVoiceId(
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
  autoFindVoiceId(
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
  autoFindVoiceId(
    {
      speaker: "HOST",
      voice: "",
      tags: [],
    },
    ELEVENLABS_PRESET_VOICES
  ),
  "21m00Tcm4TlvDq8ikWAM"
);
