import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { OpenAI } from "openai";
import { z } from "zod";
import { getOrCreateObject } from "./AWSUtils";
import { TaggedLine } from "./DialogHelpers";
import {
  autoFindPresetVoice,
  generateSoundEffect,
  generateSpeechClip,
} from "./ElevenLabsUtils";
import { fetchCompletionJson } from "./OpenAIUtils";
import { parseSchemaString } from "./SchemaParser";
import { generatePredictableKey } from "./TextHelpers";

export interface ServiceProvider {
  generateCompletionJson(
    prompt: string,
    schema: string
  ): Promise<Record<string, any>>;
  generateSoundEffect(prompt: string): Promise<{ url: string }>;
  generateSpeech(line: TaggedLine): Promise<{ url: string }>;
}

export class StubServiceProvider implements ServiceProvider {
  async generateCompletionJson(
    prompt: string,
    schema: string
  ): Promise<Record<string, any>> {
    const zodSchema = parseSchemaString(schema);
    const schemaShape = zodSchema.shape;
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(schemaShape)) {
      if (value instanceof z.ZodString) {
        result[key] = `stub_${key}_value`;
      } else if (value instanceof z.ZodNumber) {
        result[key] = 42;
      } else if (value instanceof z.ZodBoolean) {
        result[key] = true;
      } else if (value instanceof z.ZodArray) {
        result[key] = ["stub_item_1", "stub_item_2"];
      } else {
        result[key] = `stub_${key}`;
      }
    }
    return result;
  }

  async generateSoundEffect(prompt: string): Promise<{ url: string }> {
    const key = generatePredictableKey("sound-effects", prompt, "mp3");
    return { url: `https://stub-audio.test/${key}` };
  }

  async generateSpeech(line: TaggedLine): Promise<{ url: string }> {
    const prompt = `${line.speaker}:${line.tags.join(",")}:${line.line}`;
    const key = generatePredictableKey("speech", prompt, "mp3");
    return { url: `https://stub-audio.test/${key}` };
  }
}

export class RealServiceProvider implements ServiceProvider {
  constructor(
    public openai: OpenAI,
    public elevenlabs: ElevenLabsClient,
    public region: string,
    public bucket: string
  ) {}

  async generateCompletionJson(
    prompt: string,
    schema: string
  ): Promise<Record<string, any>> {
    const cacheKey = `${prompt}\n---SCHEMA---\n${schema}`;
    const key = generatePredictableKey("json", cacheKey, "json");
    const url = await getOrCreateObject(
      this.region,
      this.bucket,
      key,
      async () => {
        const zodSchema = parseSchemaString(schema);
        const result = await fetchCompletionJson(
          this.openai,
          prompt,
          "gpt-4o",
          zodSchema
        );
        if (!result) {
          console.warn("Failed to generate completion");
          return JSON.stringify({});
        }
        return JSON.stringify(result, null, 2);
      },
      "application/json"
    );
    // Fetch the cached result from S3
    const response = await fetch(url);
    return await response.json();
  }

  async generateSoundEffect(prompt: string): Promise<{ url: string }> {
    const key = generatePredictableKey("sfx", prompt, "mp3");
    const url = await getOrCreateObject(
      this.region,
      this.bucket,
      key,
      async () => {
        return await generateSoundEffect({
          client: this.elevenlabs,
          text: prompt,
          durationSeconds: 5,
        });
      },
      "audio/mpeg"
    );
    return { url };
  }

  async generateSpeech(line: TaggedLine): Promise<{ url: string }> {
    const voiceId = autoFindPresetVoice(line.speaker, line.tags);
    const prompt = `${line.speaker}:${line.tags.join(",")}:${line.line}`;
    const key = generatePredictableKey("vox", prompt, "mp3");
    const url = await getOrCreateObject(
      this.region,
      this.bucket,
      key,
      async () => {
        return await generateSpeechClip({
          client: this.elevenlabs,
          voiceId,
          text: line.line,
        });
      },
      "audio/mpeg"
    );
    return { url };
  }
}
