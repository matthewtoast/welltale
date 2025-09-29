import { mapValues } from "lodash";
import { NonEmpty, TSerial } from "../typings";
import type { FetchOptions } from "./HTTPHelpers";
import { safeJsonParse } from "./JSONHelpers";
import type { AIChatMessage } from "./OpenRouterUtils";
import { LLM_SLUGS } from "./StoryTypes";
import type { VoiceSpec } from "./StoryTypes";

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

function extractBracketContent(prompt: string): string | null {
  const match = prompt.match(/\[\[\s*(.*?)\s*\]\]/);
  return match ? match[1] : null;
}

export class MockStoryServiceProvider implements StoryServiceProvider {
  async generateText(
    prompt: string,
    options: GenerateTextCompletionOptions
  ): Promise<string> {
    return (
      extractBracketContent(prompt) ?? `Mock completion for prompt: ${prompt}`
    );
  }

  async generateJson(
    prompt: string,
    schema: Record<string, TSerial>,
    options: GenerateTextCompletionOptions
  ): Promise<Record<string, TSerial>> {
    return (
      safeJsonParse(extractBracketContent(prompt)) ??
      mapValues(schema, (value, key) => `Mock ${key}`)
    );
  }

  async generateSound(
    prompt: string,
    durationMs: number,
    options: BaseGenerateOptions
  ): Promise<{ url: string }> {
    return {
      url:
        extractBracketContent(prompt) ?? "https://example.com/mock-sound.mp3",
    };
  }

  async generateMusic(
    prompt: string,
    durationMs: number,
    options: BaseGenerateOptions
  ): Promise<{ url: string }> {
    return {
      url:
        extractBracketContent(prompt) ?? "https://example.com/mock-music.mp3",
    };
  }

  async generateSpeech(
    spec: SpeechSpec,
    voices: VoiceSpec[],
    options: BaseGenerateOptions
  ): Promise<{ url: string }> {
    return {
      url:
        extractBracketContent(spec.body) ??
        "https://example.com/mock-speech.mp3",
    };
  }

  async generateVoice(
    prompt: string,
    options: BaseGenerateOptions
  ): Promise<{ id: string }> {
    return { id: extractBracketContent(prompt) ?? "mock-voice-id" };
  }

  async generateChat(
    messages: AIChatMessage[],
    options: BaseGenerateOptions
  ): Promise<AIChatMessage> {
    const lastMessage = messages[messages.length - 1];
    const mockResponse =
      extractBracketContent(lastMessage?.body ?? "") ?? "Mock chat response";
    return { role: "assistant", body: mockResponse };
  }

  async fetchUrl(
    options: FetchOptions
  ): Promise<{ statusCode: number; data: string; contentType: string }> {
    const url = extractBracketContent(options.url);
    if (url) {
      return {
        statusCode: 200,
        data: url,
        contentType: "text/html",
      };
    }
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
