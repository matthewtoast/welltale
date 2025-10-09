import { mapValues } from "lodash";
import { NonEmpty, TSerial } from "../typings";
import type { FetchOptions } from "./HTTPHelpers";
import { safeJsonParse } from "./JSONHelpers";
import type { AIChatMessage } from "./OpenRouterUtils";
import type { VoiceSpec } from "./StoryTypes";
import { LLM_SLUGS } from "./StoryTypes";
import { parameterize } from "./TextHelpers";

export type Model = (typeof LLM_SLUGS)[number];

export type BaseGenerateOptions = {
  disableCache?: boolean;
};

export type GenerateTextCompletionOptions = BaseGenerateOptions & {
  models: NonEmpty<Model>;
  useWebSearch: boolean;
};

export type SpeechSpec = {
  speaker: string;
  voice: string;
  body: string;
  tags: string[];
  pronunciations: Record<string, string>;
};

export interface StoryServiceProvider {
  generateText(
    prompt: string,
    options: GenerateTextCompletionOptions
  ): Promise<string>;
  generateJson(
    prompt: string,
    schema: Record<string, TSerial>,
    options: GenerateTextCompletionOptions
  ): Promise<Record<string, TSerial>>;
  generateSound(
    prompt: string,
    durationMs: number,
    options: BaseGenerateOptions
  ): Promise<{ url: string }>;
  generateMusic(
    prompt: string,
    durationMs: number,
    options: BaseGenerateOptions
  ): Promise<{ url: string }>;
  generateSpeech(
    spec: SpeechSpec,
    voices: VoiceSpec[],
    options: BaseGenerateOptions
  ): Promise<{ url: string }>;
  generateVoice(
    prompt: string,
    options: BaseGenerateOptions
  ): Promise<{ id: string }>;
  generateChat(
    messages: AIChatMessage[],
    options: BaseGenerateOptions
  ): Promise<AIChatMessage>;
  fetchUrl(
    options: FetchOptions
  ): Promise<{ statusCode: number; data: string; contentType: string }>;
  fetchModerations(input: string): Promise<{
    flagged: boolean;
    reasons: Record<string, number>;
  } | null>;
}

export class MockStoryServiceProvider implements StoryServiceProvider {
  async generateText(
    prompt: string,
    options: GenerateTextCompletionOptions
  ): Promise<string> {
    return `Mock completion for prompt: ${prompt}`;
  }

  async generateJson(
    prompt: string,
    schema: Record<string, TSerial>,
    options: GenerateTextCompletionOptions
  ): Promise<Record<string, TSerial>> {
    return (
      safeJsonParse(prompt) ?? mapValues(schema, (_value, key) => `Mock ${key}`)
    );
  }

  async generateSound(
    prompt: string,
    durationMs: number,
    options: BaseGenerateOptions
  ): Promise<{ url: string }> {
    return { url: "https://example.com/mock-sound.mp3" };
  }

  async generateMusic(
    prompt: string,
    durationMs: number,
    options: BaseGenerateOptions
  ): Promise<{ url: string }> {
    return { url: "https://example.com/mock-music.mp3" };
  }

  async generateSpeech(
    spec: SpeechSpec,
    voices: VoiceSpec[],
    options: BaseGenerateOptions
  ): Promise<{ url: string }> {
    return { url: "https://example.com/mock-speech.mp3" };
  }

  async generateVoice(
    prompt: string,
    options: BaseGenerateOptions
  ): Promise<{ id: string }> {
    return { id: `mock-voice-${parameterize(prompt)}` };
  }

  async generateChat(
    messages: AIChatMessage[],
    options: BaseGenerateOptions
  ): Promise<AIChatMessage> {
    return { role: "assistant", body: "Mock chat response" };
  }

  async fetchUrl(
    options: FetchOptions
  ): Promise<{ statusCode: number; data: string; contentType: string }> {
    return {
      statusCode: 200,
      data: `Mock response for URL: ${options.url}`,
      contentType: "text/html",
    };
  }

  async fetchModerations(_input: string): Promise<{
    flagged: boolean;
    reasons: Record<string, number>;
  } | null> {
    return { flagged: false, reasons: {} };
  }
}
