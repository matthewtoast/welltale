import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { MusicComposeRequestOutputFormat } from "@elevenlabs/elevenlabs-js/api";
import { inferGenderFromName } from "./DialogHelpers";

const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128" as const;

type AudioOutputFormat =
  | "mp3_22050_32"
  | "mp3_44100_32"
  | "mp3_44100_64"
  | "mp3_44100_96"
  | "mp3_44100_128"
  | "mp3_44100_192"
  | "pcm_8000"
  | "pcm_16000"
  | "pcm_22050"
  | "pcm_24000"
  | "pcm_44100"
  | "pcm_48000"
  | "ulaw_8000"
  | "alaw_8000"
  | "opus_48000_32"
  | "opus_48000_64"
  | "opus_48000_96"
  | "opus_48000_128"
  | "opus_48000_192";

export const makeClient = (apiKey = process.env.ELEVENLABS_API_KEY ?? "") =>
  new ElevenLabsClient({ apiKey });

async function streamToUint8Array(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

export const composeTrack = async ({
  client,
  prompt,
  musicLengthMs = 30000,
  outputFormat = DEFAULT_OUTPUT_FORMAT,
}: {
  client: ElevenLabsClient;
  prompt: string;
  musicLengthMs?: number;
  outputFormat?: MusicComposeRequestOutputFormat;
}): Promise<Uint8Array> => {
  const stream = await client.music.compose({
    prompt,
    musicLengthMs,
    outputFormat,
  });
  return streamToUint8Array(stream);
};

export const generateSoundEffect = async ({
  client,
  text,
  durationSeconds,
  promptInfluence = 0.3,
  outputFormat = DEFAULT_OUTPUT_FORMAT,
}: {
  client: ElevenLabsClient;
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
  outputFormat?: AudioOutputFormat;
}): Promise<Uint8Array> => {
  const stream = await client.textToSoundEffects.convert({
    text,
    durationSeconds,
    promptInfluence,
    outputFormat,
  });
  return streamToUint8Array(stream);
};

export const generateSpeechClip = async ({
  client,
  voiceId,
  text,
  modelId = "eleven_multilingual_v2",
  outputFormat = DEFAULT_OUTPUT_FORMAT,
}: {
  client: ElevenLabsClient;
  voiceId: string;
  text: string;
  modelId?: string;
  outputFormat?: AudioOutputFormat;
}): Promise<Uint8Array> => {
  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId,
    outputFormat,
  });
  return streamToUint8Array(stream);
};

export function autoFindPresetVoice(speaker: string, tags: string[]) {
  for (let i = 0; i < PRESET_VOICES.length; i++) {
    if (tags.includes(PRESET_VOICES[i].id)) {
      return PRESET_VOICES[i].id;
    }
  }
  for (let i = 0; i < PRESET_VOICES.length; i++) {
    if (
      tags.includes(PRESET_VOICES[i].name) ||
      speaker === PRESET_VOICES[i].name
    ) {
      return PRESET_VOICES[i].id;
    }
  }
  const gender = inferGenderFromName(speaker);
  if (gender && !tags.includes(gender)) {
    tags.push(gender);
  }
  let bestMatch = null;
  let maxMatches = 0;
  for (let i = 0; i < PRESET_VOICES.length; i++) {
    const voice = PRESET_VOICES[i];
    const matchCount = voice.tags.filter((tag) => tags.includes(tag)).length;
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestMatch = voice;
    }
  }
  return bestMatch ? bestMatch.id : NEUTRAL_VOICE;
}

export const NEUTRAL_VOICE = "21m00Tcm4TlvDq8ikWAM";

export const PRESET_VOICES = [
  {
    name: "Adam",
    id: "pNInz6obpgDQGcFmaJgB",
    tags: ["male", "man", "deep", "american", "narration"],
  },
  {
    name: "Alice",
    id: "Xb7hH8MSUJpSbSDYk0k2",
    tags: ["female", "woman", "confident", "british", "news"],
  },
  {
    name: "Antoni",
    id: "ErXwobaYiN019PkySvjV",
    tags: ["male", "man", "boy", "young", "american", "narration"],
  },
  {
    name: "Arnold",
    id: "VR6AewLTigWG4xSOukaG",
    tags: ["male", "man", "crisp", "american", "narration"],
  },
  {
    name: "Bill",
    id: "pqHfZKP75CvOlQylNhV4",
    tags: ["male", "man", "strong", "american", "documentary"],
  },
  {
    name: "Brian",
    id: "nPczCjzI2devNBz1zQrb",
    tags: ["male", "man", "deep", "american", "narration"],
  },
  {
    name: "Callum",
    id: "N2lVS1w4EtoT3dr4eOWO",
    tags: ["male", "man", "hoarse", "american", "games"],
  },
  {
    name: "Charlie",
    id: "IKne3meq5aSn9XLyUdCD",
    tags: ["male", "man", "casual", "australian", "conversational"],
  },
  {
    name: "Charlotte",
    id: "XB0fDUnXU5powFXDhCwa",
    tags: ["female", "woman", "middle aged", "seductive", "games"],
  },
  {
    name: "Chris",
    id: "iP95p4xoKVk53GoZ742B",
    tags: ["male", "man", "casual", "american", "conversational"],
  },
  {
    name: "Clyde",
    id: "2EiwWnXFnvU5JabPnv8n",
    tags: ["male", "man", "war veteran", "american", "games"],
  },
  {
    name: "Daniel",
    id: "onwK4e9ZLuTAKqWW03F9",
    tags: ["male", "man", "deep", "british", "news"],
  },
  {
    name: "Dave",
    id: "CYw3kZ02Hs0563khs1Fj",
    tags: [
      "male",
      "man",
      "boy",
      "young",
      "conversational",
      "british-essex",
      "games",
    ],
  },
  {
    name: "Domi",
    id: "AZnzlk1XvdvUeBnXmlld",
    tags: [
      "female",
      "woman",
      "girl",
      "young",
      "strong",
      "american",
      "narration",
    ],
  },
  {
    name: "Dorothy",
    id: "ThT5KcBeYPX3keUQqHPh",
    tags: ["female", "woman", "girl", "young", "pleasant", "british"],
  },
  {
    name: "Drew",
    id: "29vD33N1CtxCmqQRPOHJ",
    tags: ["male", "man", "american", "news"],
  },
  {
    name: "Emily",
    id: "LcfcDJNUP1GQjkzn1xUU",
    tags: [
      "female",
      "woman",
      "girl",
      "young",
      "calm",
      "american",
      "meditation",
    ],
  },
  {
    name: "Ethan",
    id: "g5CIjZEefAph4nQFvHAz",
    tags: ["male", "man", "boy", "young", "american", "asmr"],
  },
  {
    name: "Fin",
    id: "D38z5RcWu1voky8WS1ja",
    tags: ["male", "man", "old", "sailor", "irish", "games"],
  },
  {
    name: "Freya",
    id: "jsCqWAovK2LkecY7zXl4",
    tags: ["female", "woman", "girl", "young", "american"],
  },
  {
    name: "George",
    id: "JBFqnCBsd6RMkjVDRZzb",
    tags: ["male", "man", "raspy", "british", "narration"],
  },
  {
    name: "Gigi",
    id: "jBpfuIE2acCO8z3wKNLl",
    tags: [
      "female",
      "woman",
      "girl",
      "young",
      "childish",
      "american",
      "animation",
    ],
  },
  {
    name: "Giovanni",
    id: "zcAOhNBS3c14rBihAFp1",
    tags: [
      "male",
      "man",
      "boy",
      "young",
      "foreigner",
      "english-italian",
      "audiobook",
    ],
  },
  {
    name: "Glinda",
    id: "z9fAnlkpzviPz146aGWa",
    tags: ["female", "woman", "witch", "american", "games"],
  },
  {
    name: "Grace",
    id: "oWAxZDx7w5VEj9dCyTzz",
    tags: [
      "female",
      "woman",
      "girl",
      "young",
      "american-southern",
      "audiobook",
    ],
  },
  {
    name: "Harry",
    id: "SOYHLrjzK2X1ezoPC6cr",
    tags: ["male", "man", "boy", "young", "anxious", "american", "games"],
  },
  {
    name: "James",
    id: "ZQe5CZNOzWyzPSCn5a3c",
    tags: ["male", "man", "old", "calm", "australian", "news"],
  },
  {
    name: "Jeremy",
    id: "bVMeCyTHy58xNoL34h3p",
    tags: [
      "male",
      "man",
      "boy",
      "young",
      "excited",
      "american-irish",
      "narration",
    ],
  },
  {
    name: "Jessie",
    id: "t0jbNlBVZ17f02VDIeMI",
    tags: ["male", "man", "old", "raspy", "american", "games"],
  },
  {
    name: "Joseph",
    id: "Zlb1dXrM653N07WRdFW3",
    tags: ["male", "man", "british", "news"],
  },
  {
    name: "Josh",
    id: "TxGEqnHWrfWFTfGW9XjX",
    tags: ["male", "man", "boy", "young", "deep", "american", "narration"],
  },
  {
    name: "Liam",
    id: "TX3LPaxmHKxFdv7VOQHJ",
    tags: ["male", "man", "boy", "young", "american", "narration"],
  },
  {
    name: "Lily",
    id: "pFZP5JQG7iQjIQuC4Bku",
    tags: ["female", "woman", "raspy", "british", "narration"],
  },
  {
    name: "Matilda",
    id: "XrExE9yKIg1WjnnlVkGX",
    tags: ["female", "woman", "girl", "young", "warm", "american", "audiobook"],
  },
  {
    name: "Michael",
    id: "flq6f7yk4E4fJM5XTYuZ",
    tags: ["male", "man", "old", "american", "audiobook"],
  },
  {
    name: "Mimi",
    id: "zrHiDhphv9ZnVXBqCLjz",
    tags: [
      "female",
      "woman",
      "young",
      "childish",
      "english-swedish",
      "animation",
    ],
  },
  {
    name: "Nicole",
    id: "piTKgcLEGmPE4e6mEKli",
    tags: [
      "female",
      "woman",
      "girl",
      "young",
      "whisper",
      "american",
      "audiobook",
    ],
  },
  {
    name: "Patrick",
    id: "ODq5zmih8GrVes37Dizd",
    tags: ["male", "man", "shouty", "american", "games"],
  },
  {
    name: "Paul",
    id: "5Q0t7uMcjvnagumLfvZi",
    tags: ["male", "man", "ground reporter", "american", "news"],
  },
  {
    name: "Rachel",
    id: "21m00Tcm4TlvDq8ikWAM",
    tags: [
      "female",
      "young",
      "calm",
      "expressive",
      "american",
      "narration",
      "social media",
    ],
  },
  {
    name: "Sam",
    id: "yoZ06aMxZJJ28mfd3POQ",
    tags: ["male", "man", "boy", "young", "raspy", "american", "narration"],
  },
  {
    name: "Sarah",
    id: "EXAVITQu4vr4xnSDxMaL",
    tags: ["female", "woman", "girl", "young", "soft", "american", "news"],
  },
  {
    name: "Serena",
    id: "pMsXgVXv3BLzUgSXRplE",
    tags: ["female", "woman", "pleasant", "american", "interactive"],
  },
  {
    name: "Thomas",
    id: "GBv7mTt0atIp3Br8iCZE",
    tags: ["male", "man", "boy", "young", "calm", "american", "meditation"],
  },
];
