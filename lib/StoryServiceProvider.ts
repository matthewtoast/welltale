import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { map } from "lodash";
import { OpenAI } from "openai";
import { NonEmpty, TSerial } from "typings";
import { Cache } from "./Cache";
import {
  autoFindVoice,
  composeTrack,
  generateSoundEffect,
  generateSpeechClip,
  generateVoiceFromPrompt,
} from "./ElevenLabsUtils";
import { safeJsonParse } from "./JSONHelpers";
import {
  generateJson,
  generateJsonWithWeb,
  generateText,
} from "./OpenRouterUtils";
import { LLM_SLUGS, VoiceSpec } from "./StoryTypes";
import { generatePredictableKey } from "./TextHelpers";

type Model = (typeof LLM_SLUGS)[number];

export type GenerateOptions = {
  models: NonEmpty<Model>;
  useWebSearch: boolean;
};

export type SpeechSpec = {
  speaker: string;
  voice: string;
  body: string;
  tags: string[];
};

export interface StoryServiceProvider {
  generateText(prompt: string, options: GenerateOptions): Promise<string>;
  generateJson(
    prompt: string,
    schema: Record<string, TSerial>,
    options: GenerateOptions
  ): Promise<Record<string, TSerial>>;
  generateSound(prompt: string, durationMs: number): Promise<{ url: string }>;
  generateMusic(prompt: string, durationMs: number): Promise<{ url: string }>;
  generateSpeech(
    spec: SpeechSpec,
    voices: VoiceSpec[]
  ): Promise<{ url: string }>;
  generateVoice(prompt: string): Promise<{ id: string }>;
}

export abstract class BaseStoryServiceProvider implements StoryServiceProvider {
  constructor(
    public config: {
      openai: OpenAI;
      eleven: ElevenLabsClient;
      cache: Cache;
      disableCache?: boolean;
    }
  ) {}

  async generateText(
    prompt: string,
    options: GenerateOptions
  ): Promise<string> {
    const useCache = !this.config.disableCache;
    const key = generatePredictableKey("text", prompt, "txt");
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        return cached.toString();
      }
    }
    const result = await generateText(
      this.config.openai,
      prompt,
      options.useWebSearch,
      options.models
    );
    if (!result) {
      console.warn("Failed to generate completion");
      return "";
    }
    if (useCache) {
      const buffer = Buffer.from(result);
      await this.config.cache.set(key, buffer, "text/plain");
    }
    return result;
  }

  async generateJson(
    prompt: string,
    schema: Record<string, TSerial>,
    options: GenerateOptions
  ): Promise<Record<string, TSerial>> {
    const useCache = !this.config.disableCache;
    const cacheKey = `${prompt}\n${schema}`;
    const key = generatePredictableKey("json", cacheKey, "json");
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        return JSON.parse(cached.toString());
      }
    }
    const result = options.useWebSearch
      ? await generateJsonWithWeb(
          this.config.openai,
          prompt,
          JSON.stringify(schema),
          options.models
        )
      : await generateJson(
          this.config.openai,
          prompt,
          JSON.stringify(schema),
          options.models
        );
    if (!result) {
      console.warn("Failed to generate completion");
      return {};
    }
    if (useCache) {
      const buffer = Buffer.from(JSON.stringify(result, null, 2));
      await this.config.cache.set(key, buffer, "application/json");
    }
    return result;
  }

  async generateSound(
    prompt: string,
    durationMs: number
  ): Promise<{ url: string }> {
    const useCache = !this.config.disableCache;
    const key = generatePredictableKey("sfx", `${prompt}:${durationMs}`, "mp3");
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        const url = await this.config.cache.set(key, cached, "audio/mpeg");
        return { url };
      }
    }
    const audio = await generateSoundEffect({
      client: this.config.eleven,
      text: prompt,
      durationSeconds: Math.ceil(durationMs / 1000),
    });
    const url = await this.config.cache.set(
      key,
      Buffer.from(audio),
      "audio/mpeg"
    );
    return { url };
  }

  async generateMusic(
    prompt: string,
    durationMs: number
  ): Promise<{ url: string }> {
    const useCache = !this.config.disableCache;
    const key = generatePredictableKey(
      "music",
      `${prompt}:${durationMs}`,
      "mp3"
    );
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        const url = await this.config.cache.set(key, cached, "audio/mpeg");
        return { url };
      }
    }
    const audio = await composeTrack({
      client: this.config.eleven,
      prompt,
      musicLengthMs: durationMs,
    });
    const url = await this.config.cache.set(
      key,
      Buffer.from(audio),
      "audio/mpeg"
    );
    return { url };
  }

  async generateSpeech(
    spec: SpeechSpec,
    voices: VoiceSpec[]
  ): Promise<{ url: string }> {
    const useCache = !this.config.disableCache;
    const voiceId = autoFindVoice(spec, voices);
    const promptKey = `${spec.speaker}:${spec.voice}:${spec.tags.join(",")}:${spec.body}:${voiceId}`;
    const key = generatePredictableKey("vox", promptKey, "mp3");
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        const url = await this.config.cache.set(key, cached, "audio/mpeg");
        return { url };
      }
    }
    const audio = await generateSpeechClip({
      client: this.config.eleven,
      voiceId,
      text: spec.body,
    });
    const url = await this.config.cache.set(
      key,
      Buffer.from(audio),
      "audio/mpeg"
    );
    return { url };
  }

  async generateVoice(prompt: string): Promise<{ id: string }> {
    const useCache = !this.config.disableCache;
    const key = generatePredictableKey("voice", prompt, "txt");
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        return { id: cached.toString() };
      }
    }
    const base = key.split("/").pop() || "voice";
    const name = `Voice ${base.replace(/\.[^.]+$/, "")}`;
    const res = await generateVoiceFromPrompt({
      client: this.config.eleven,
      voiceName: name,
      voiceDescription: prompt,
    });
    if (useCache) {
      const buf = Buffer.from(res.voiceId);
      await this.config.cache.set(key, buf, "text/plain");
    }
    return { id: res.voiceId };
  }
}

export class DefaultStoryServiceProvider extends BaseStoryServiceProvider {}

function extractBracketContent(prompt: string): string | null {
  const match = prompt.match(/\[\[\s*(.*?)\s*\]\]/);
  return match ? match[1] : null;
}

export class MockStoryServiceProvider implements StoryServiceProvider {
  async generateText(
    prompt: string,
    options: GenerateOptions
  ): Promise<string> {
    return (
      extractBracketContent(prompt) ?? `Mock completion for prompt: ${prompt}`
    );
  }

  async generateJson(
    prompt: string,
    schema: Record<string, TSerial>,
    options: GenerateOptions
  ): Promise<Record<string, TSerial>> {
    return (
      safeJsonParse(extractBracketContent(prompt)) ??
      map(schema, (value, key) => `Mock ${key}`)
    );
  }

  async generateSound(prompt: string): Promise<{ url: string }> {
    return {
      url:
        extractBracketContent(prompt) ?? "https://example.com/mock-sound.mp3",
    };
  }

  async generateMusic(prompt: string): Promise<{ url: string }> {
    return {
      url:
        extractBracketContent(prompt) ?? "https://example.com/mock-music.mp3",
    };
  }

  async generateSpeech(
    spec: SpeechSpec,
    voices: VoiceSpec[]
  ): Promise<{ url: string }> {
    return {
      url:
        extractBracketContent(spec.body) ??
        "https://example.com/mock-speech.mp3",
    };
  }

  async generateVoice(prompt: string): Promise<{ id: string }> {
    return { id: extractBracketContent(prompt) ?? "mock-voice-id" };
  }
}
