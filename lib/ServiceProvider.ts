import { S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import chalk from "chalk";
import { OpenAI } from "openai";
import { join } from "path";
import { getOrCreateObject } from "./AWSUtils";
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
      s3: S3Client;
      bucket: string;
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
    const url = await getOrCreateObject(
      this.config.s3,
      this.config.bucket,
      key,
      async () => {
        const zodSchema = parseSchemaString(schema);
        const result = await generateJson(
          this.config.openai,
          `${prompt}\n\nReturn only JSON per the schema:`,
          zodSchema,
          "gpt-4.1"
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

  async generateSound(prompt: string): Promise<{ url: string }> {
    const key = generatePredictableKey("sfx", prompt, "mp3");
    const url = await getOrCreateObject(
      this.config.s3,
      this.config.bucket,
      key,
      async () => {
        return await generateSoundEffect({
          client: this.config.eleven,
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
    const prompt = `${line.speaker}:${line.tags.join(",")}:${line.body}`;
    const key = generatePredictableKey("vox", prompt, "mp3");
    const url = await getOrCreateObject(
      this.config.s3,
      this.config.bucket,
      key,
      async () => {
        return await generateSpeechClip({
          client: this.config.eleven,
          voiceId,
          text: line.body,
        });
      },
      "audio/mpeg"
    );
    return { url };
  }
}

function shouldJsonify(a: any) {
  return Array.isArray(a) || (a && typeof a === "object");
}
