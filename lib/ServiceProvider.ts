import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { OpenAI } from "openai";
import { join } from "path";
import { Cache } from "./Cache";
import { TaggedLine } from "./DialogHelpers";
import {
  autoFindPresetVoice,
  generateSoundEffect,
  generateSpeechClip,
} from "./ElevenLabsUtils";
import { loadDirRecursive } from "./FileUtils";
import { generateJson } from "./OpenAIUtils";
import { Cartridge } from "./StoryEngine";
import { generatePredictableKey } from "./TextHelpers";
import { parseSchemaString } from "./ZodHelpers";

export interface ServiceProvider {
  loadCartridge(storyId: string): Promise<Cartridge>;
  generateJson(prompt: string, schema: string): Promise<Record<string, any>>;
  generateSound(prompt: string): Promise<{ url: string }>;
  generateSpeech(line: TaggedLine): Promise<{ url: string }>;
  log(...args: any[]): void;
}

export class DefaultServiceProvider implements ServiceProvider {
  constructor(
    public config: {
      openai: OpenAI;
      eleven: ElevenLabsClient;
      cache: Cache;
    }
  ) {}

  log(...args: any[]) {
    console.info(
      chalk.gray(...args.map((a) => (shouldJsonify(a) ? JSON.stringify(a) : a)))
    );
  }

  async loadCartridge(storyId: string): Promise<Cartridge> {
    return await loadDirRecursive(
      join(__dirname, "..", "run", "cartridges", storyId)
    );
  }

  async generateJson(
    prompt: string,
    schema: string
  ): Promise<Record<string, any>> {
    const cacheKey = `${prompt}\n---SCHEMA---\n${schema}`;
    const key = generatePredictableKey("json", cacheKey, "json");
    
    const cached = await this.config.cache.get(key);
    if (cached) {
      return JSON.parse(cached.toString());
    }
    
    const zodSchema = parseSchemaString(schema);
    const result = await generateJson(
      this.config.openai,
      `${prompt}\n\nReturn only JSON per the schema:`,
      zodSchema,
      "gpt-4.1"
    );
    
    if (!result) {
      console.warn("Failed to generate completion");
      return {};
    }
    
    const buffer = Buffer.from(JSON.stringify(result, null, 2));
    await this.config.cache.set(key, buffer, "application/json");
    
    return result;
  }

  async generateSound(prompt: string): Promise<{ url: string }> {
    const key = generatePredictableKey("sfx", prompt, "mp3");
    
    const cached = await this.config.cache.get(key);
    if (cached) {
      const url = await this.config.cache.set(key, cached, "audio/mpeg");
      return { url };
    }
    
    const audio = await generateSoundEffect({
      client: this.config.eleven,
      text: prompt,
      durationSeconds: 5,
    });
    
    const url = await this.config.cache.set(key, Buffer.from(audio), "audio/mpeg");
    return { url };
  }

  async generateSpeech(line: TaggedLine): Promise<{ url: string }> {
    const voiceId = autoFindPresetVoice(line.speaker, line.tags);
    const prompt = `${line.speaker}:${line.tags.join(",")}:${line.body}`;
    const key = generatePredictableKey("vox", prompt, "mp3");
    
    const cached = await this.config.cache.get(key);
    if (cached) {
      const url = await this.config.cache.set(key, cached, "audio/mpeg");
      return { url };
    }
    
    const audio = await generateSpeechClip({
      client: this.config.eleven,
      voiceId,
      text: line.body,
    });
    
    const url = await this.config.cache.set(key, Buffer.from(audio), "audio/mpeg");
    return { url };
  }
}

function shouldJsonify(a: any) {
  return Array.isArray(a) || (a && typeof a === "object");
}
