import { mapValues } from "lodash";
import { NonEmpty, TSerial } from "../typings";
import type { FetchOptions } from "./HTTPHelpers";
import { safeJsonParse } from "./JSONHelpers";
import type {
  AIChatMessage,
  TOpenRouterModerationCategory,
  TOpenRouterModerationResult,
} from "./OpenRouterUtils";
import { OpenRouterModerationCategories } from "./OpenRouterUtils";
import type { ImageAspectRatio, ImageModelSlug, VoiceSpec } from "./StoryTypes";
import { LLM_SLUGS } from "./StoryTypes";
import { parameterize } from "./TextHelpers";

export type Model = (typeof LLM_SLUGS)[number];

export type BaseGenerateOptions = {
  disableCache?: boolean;
  seed?: string;
};

export type GenerateTextCompletionOptions = BaseGenerateOptions & {
  models: NonEmpty<Model>;
  useWebSearch: boolean;
};

export type GenerateImageOptions = BaseGenerateOptions & {
  model: ImageModelSlug;
  aspectRatio?: ImageAspectRatio;
};

export type ModerateOptions = {
  models: NonEmpty<Model>;
  threshold: number;
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
  generateChat(
    messages: AIChatMessage[],
    options: GenerateTextCompletionOptions
  ): Promise<AIChatMessage>;
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
  generateImage(
    prompt: string,
    options: GenerateImageOptions
  ): Promise<{ url: string }>;
  fetchUrl(
    options: FetchOptions
  ): Promise<{ statusCode: number; data: string; contentType: string }>;
  fetchModerations(input: string): Promise<{
    flagged: boolean;
    reasons: Record<string, number>;
  } | null>;
  moderateInput(
    input: string,
    options: ModerateOptions
  ): Promise<TOpenRouterModerationResult | null>;
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

  async generateImage(
    prompt: string,
    options: GenerateImageOptions
  ): Promise<{ url: string }> {
    return { url: "https://example.com/mock-image.png" };
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

  async moderateInput(
    _input: string,
    _options: ModerateOptions
  ): Promise<TOpenRouterModerationResult | null> {
    const scores = {} as Record<TOpenRouterModerationCategory, number>;
    (
      Object.keys(
        OpenRouterModerationCategories
      ) as TOpenRouterModerationCategory[]
    ).forEach((k) => {
      scores[k] = 0;
    });
    return { flagged: false, scores };
  }
}
