import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  MusicComposeRequestOutputFormat,
  TextToSoundEffectsConvertRequestOutputFormat,
  TextToSpeechConvertRequestOutputFormat,
  TextToVoiceDesignRequestOutputFormat,
} from "@elevenlabs/elevenlabs-js/api";
import { inferGenderFromName } from "./DialogHelpers";
import { NEUTRAL_VOICE } from "./ElevenLabsVoices";
import { VoiceSpec } from "./StoryTypes";

const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128" as const;

export const makeClient = (apiKey = process.env.ELEVENLABS_API_KEY ?? "") =>
  new ElevenLabsClient({ apiKey });

async function streamToUint8Array(stream: ReadableStream<Uint8Array>) {
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
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export const composeTrack = async ({
  client,
  prompt,
  musicLengthMs,
  outputFormat = DEFAULT_OUTPUT_FORMAT as MusicComposeRequestOutputFormat,
  modelId = "music_v1",
}: {
  client: ElevenLabsClient;
  prompt: string;
  musicLengthMs: number;
  outputFormat?: MusicComposeRequestOutputFormat;
  modelId?: "music_v1";
}) => {
  const stream = await client.music.compose({
    prompt,
    musicLengthMs,
    modelId,
    outputFormat,
  });
  return streamToUint8Array(stream);
};

export const generateSoundEffect = async ({
  client,
  text,
  durationSeconds,
  promptInfluence = 0.3,
  loop = false,
  modelId = "eleven_text_to_sound_v2",
  outputFormat = DEFAULT_OUTPUT_FORMAT as TextToSoundEffectsConvertRequestOutputFormat,
}: {
  client: ElevenLabsClient;
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
  loop?: boolean;
  modelId?: string;
  outputFormat?: TextToSoundEffectsConvertRequestOutputFormat;
}) => {
  const stream = await client.textToSoundEffects.convert({
    text,
    durationSeconds,
    promptInfluence,
    loop,
    modelId,
    outputFormat,
  });
  return streamToUint8Array(stream);
};

export const generateSpeechClip = async ({
  client,
  voiceId,
  text,
  modelId = "eleven_v3",
  outputFormat = DEFAULT_OUTPUT_FORMAT as TextToSpeechConvertRequestOutputFormat,
  languageCode,
  seed,
}: {
  client: ElevenLabsClient;
  voiceId: string;
  text: string;
  modelId?: string;
  outputFormat?: TextToSpeechConvertRequestOutputFormat;
  languageCode?: string | null;
  seed?: number;
}) => {
  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId,
    outputFormat,
    languageCode: languageCode ?? undefined,
    seed,
  });
  return streamToUint8Array(stream);
};

export const generateVoiceFromPrompt = async ({
  client,
  voiceName,
  voiceDescription,
  modelId = "eleven_ttv_v3",
  text,
  autoGenerateText = true,
  outputFormat = "mp3_44100_192" as TextToVoiceDesignRequestOutputFormat,
  loudness = 0.5,
  guidanceScale = 5,
  quality,
  seed,
  referenceAudioBase64,
  promptStrength,
}: {
  client: ElevenLabsClient;
  voiceName: string;
  voiceDescription: string;
  modelId?: "eleven_multilingual_ttv_v2" | "eleven_ttv_v3";
  text?: string;
  autoGenerateText?: boolean;
  outputFormat?: TextToVoiceDesignRequestOutputFormat;
  loudness?: number;
  guidanceScale?: number;
  quality?: number | null;
  seed?: number;
  referenceAudioBase64?: string | null;
  promptStrength?: number | null;
}) => {
  const design = await client.textToVoice.design({
    voiceDescription,
    modelId,
    text: text ?? undefined,
    autoGenerateText,
    outputFormat,
    loudness,
    guidanceScale,
    quality: quality ?? undefined,
    seed,
    referenceAudioBase64: referenceAudioBase64 ?? undefined,
    promptStrength: promptStrength ?? undefined,
  });

  const preview = design.previews?.[0];
  if (!preview) throw new Error("No voice previews returned");
  const generatedVoiceId = preview.generatedVoiceId;

  const created = await client.textToVoice.create({
    voiceName,
    voiceDescription,
    generatedVoiceId,
  });

  return {
    voiceId: created.voiceId,
    generatedVoiceId,
  };
};

export function autoFindVoice(
  spec: { speaker: string; voice: string; tags: string[] },
  voices: VoiceSpec[]
) {
  // id (or ref) match is highest precedence
  // ref is provided in case the external system had a different identifier for the same voice
  // id is always the elevenlabs voice id, ref is some external id
  for (let i = 0; i < voices.length; i++) {
    const id = voices[i].id;
    const ref = voices[i].ref;
    if (
      spec.voice === id ||
      spec.voice === ref ||
      spec.tags.includes(id) ||
      spec.tags.includes(ref)
    ) {
      return id;
    }
  }
  // match by voice name
  for (let i = 0; i < voices.length; i++) {
    if (spec.voice === voices[i].name) {
      return voices[i].id;
    }
  }
  // match by given speaker or find name match in tags
  for (let i = 0; i < voices.length; i++) {
    if (spec.tags.includes(voices[i].name) || spec.speaker === voices[i].name) {
      return voices[i].id;
    }
  }
  // find best fit given most tag matches
  const gender = inferGenderFromName(spec.speaker);
  if (gender && !spec.tags.includes(gender)) {
    spec.tags.push(gender);
  }
  let bestMatch = null;
  let maxMatches = 0;
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    const matchCount = voice.tags.filter((tag) =>
      spec.tags.includes(tag)
    ).length;
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestMatch = voice;
    }
  }
  return bestMatch ? bestMatch.id : voices[0] ? voices[0].id : NEUTRAL_VOICE;
}
