import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { OpenAI } from "openai";
import { TSerial } from "typings";
import { Cache } from "./Cache";
import {
  autoFindPresetVoice,
  composeTrack,
  generateSoundEffect,
  generateSpeechClip,
} from "./ElevenLabsUtils";
import { generateJson, generateJsonWithWeb, generateText } from "./OpenAIUtils";
import { StoryEvent } from "./StoryEngine";
import { generatePredictableKey } from "./TextHelpers";

export interface ServiceProvider {
  generateText(prompt: string, useWebSearch: boolean): Promise<string>;
  generateJson(
    prompt: string,
    schema: Record<string, TSerial>,
    useWebSearch: boolean
  ): Promise<Record<string, any>>;
  generateSound(prompt: string): Promise<{ url: string }>;
  generateMusic(prompt: string): Promise<{ url: string }>;
  generateSpeech(event: {
    from: string;
    body: string;
  }): Promise<{ url: string }>;
}

export abstract class BaseServiceProvider implements ServiceProvider {
  constructor(
    public config: {
      openai: OpenAI;
      eleven: ElevenLabsClient;
      cache: Cache;
      disableCache?: boolean;
    }
  ) {}

  async generateText(prompt: string, useWebSearch: boolean): Promise<string> {
    const useCache = !this.config.disableCache;
    const key = generatePredictableKey("text", prompt, "txt");
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        return cached.toString();
      }
    }
    const result = await generateText(this.config.openai, prompt, useWebSearch);
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
    useWebSearch: boolean = false
  ): Promise<Record<string, any>> {
    const useCache = !this.config.disableCache;
    const cacheKey = `${prompt}\n${schema}`;
    const key = generatePredictableKey("json", cacheKey, "json");
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        return JSON.parse(cached.toString());
      }
    }
    const result = useWebSearch
      ? await generateJsonWithWeb(
          this.config.openai,
          prompt,
          JSON.stringify(schema)
        )
      : await generateJson(this.config.openai, prompt, JSON.stringify(schema));
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

  async generateSound(prompt: string): Promise<{ url: string }> {
    const useCache = !this.config.disableCache;
    const key = generatePredictableKey("sfx", prompt, "mp3");
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
      durationSeconds: 5,
    });
    const url = await this.config.cache.set(
      key,
      Buffer.from(audio),
      "audio/mpeg"
    );
    return { url };
  }

  async generateMusic(prompt: string): Promise<{ url: string }> {
    const useCache = !this.config.disableCache;
    const key = generatePredictableKey("music", prompt, "mp3");
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
    });
    const url = await this.config.cache.set(
      key,
      Buffer.from(audio),
      "audio/mpeg"
    );
    return { url };
  }

  async generateSpeech(line: StoryEvent): Promise<{ url: string }> {
    const useCache = !this.config.disableCache;
    const voiceId = autoFindPresetVoice(line.from, line.tags);
    const prompt = `${line.from}:${line.tags.join(",")}:${line.body}`;
    const key = generatePredictableKey("vox", prompt, "mp3");

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
      text: line.body,
    });

    const url = await this.config.cache.set(
      key,
      Buffer.from(audio),
      "audio/mpeg"
    );
    return { url };
  }
}

function shouldJsonify(a: any) {
  return Array.isArray(a) || (a && typeof a === "object");
}

export class DefaultServiceProvider extends BaseServiceProvider {}
