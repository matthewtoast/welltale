import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { mapValues } from "lodash";
import { OpenAI } from "openai";
import { NonEmpty, TSerial } from "../typings";
import { Cache } from "./Cache";
import {
  autoFindVoice,
  composeTrack,
  generateSoundEffect,
  generateSpeechClip,
  generateVoiceFromPrompt,
} from "./ElevenLabsUtils";
import { fetch, FetchOptions } from "./HTTPHelpers";
import { safeJsonParse } from "./JSONHelpers";
import {
  AIChatMessage,
  generateChatResponse,
  generateJson,
  generateJsonWithWeb,
  generateText,
} from "./OpenRouterUtils";
import { LLM_SLUGS, VoiceSpec } from "./StoryTypes";
import { generatePredictableKey, parameterize } from "./TextHelpers";

type Model = (typeof LLM_SLUGS)[number];

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

export abstract class BaseStoryServiceProvider implements StoryServiceProvider {
  constructor(
    public config: {
      openai: OpenAI;
      eleven: ElevenLabsClient;
      cache: Cache;
    },
    public options: {
      disableCache?: boolean;
      verbose?: boolean;
    }
  ) {}

  async generateText(
    prompt: string,
    options: GenerateTextCompletionOptions
  ): Promise<string> {
    const useCache = !this.options.disableCache && !options.disableCache;
    const idemp = `${JSON.stringify(options.models)}:${parameterize(prompt)}`;
    if (this.options.verbose) {
      console.info(`Generate Text ~> ${idemp}`);
    }
    const key = generatePredictableKey("text", idemp, "txt");
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
    options: GenerateTextCompletionOptions
  ): Promise<Record<string, TSerial>> {
    const useCache = !this.options.disableCache && !options.disableCache;
    const idemp = `${JSON.stringify(options.models)}:${prompt}:${JSON.stringify(schema)}:${options.useWebSearch}`;
    if (this.options.verbose) {
      console.info(`Generate JSON ~> ${idemp}`);
    }
    const key = generatePredictableKey("json", idemp, "json");
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
    durationMs: number,
    options: BaseGenerateOptions
  ): Promise<{ url: string }> {
    const useCache = !this.options.disableCache && !options.disableCache;
    const idemp = `${prompt}:${durationMs}`;
    if (this.options.verbose) {
      console.info(`Generate Sound ~> ${idemp}`);
    }
    const key = generatePredictableKey("sfx", idemp, "mp3");
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
    durationMs: number,
    options: BaseGenerateOptions
  ): Promise<{ url: string }> {
    const useCache = !this.options.disableCache && !options.disableCache;
    const idemp = `${prompt}:${durationMs}`;
    if (this.options.verbose) {
      console.info(`Generate Music ~> ${idemp}`);
    }
    const key = generatePredictableKey("music", idemp, "mp3");
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
    voices: VoiceSpec[],
    options: BaseGenerateOptions
  ): Promise<{ url: string }> {
    const useCache = !this.options.disableCache && !options.disableCache;
    const voiceId = autoFindVoice(spec, voices);
    const bodyWithPronunciations = applyPronunciations(
      spec.body,
      spec.pronunciations
    );
    const idemp = `${spec.speaker}:${spec.voice}:${JSON.stringify(spec.tags)}:${parameterize(bodyWithPronunciations)}:${voiceId}:${voices.length}`;
    if (this.options.verbose) {
      console.info(`Generate Speech ~> ${idemp}`);
    }
    const key = generatePredictableKey("vox", idemp, "mp3");
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
      text: bodyWithPronunciations,
    });
    const url = await this.config.cache.set(
      key,
      Buffer.from(audio),
      "audio/mpeg"
    );
    return { url };
  }

  async generateVoice(
    prompt: string,
    options: BaseGenerateOptions
  ): Promise<{ id: string }> {
    const useCache = !this.options.disableCache && !options.disableCache;
    const idemp = prompt;
    if (this.options.verbose) {
      console.info(`Generate Voice ~> ${idemp}`);
    }
    const key = generatePredictableKey("voice", idemp, "txt");
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

  async generateChat(
    messages: AIChatMessage[],
    options: BaseGenerateOptions
  ): Promise<AIChatMessage> {
    const useCache = !this.options.disableCache && !options.disableCache;
    const idemp = JSON.stringify(messages);
    if (this.options.verbose) {
      console.info(`Generate Chat ~> ${idemp}`);
    }
    const key = generatePredictableKey("chat", idemp, "json");
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        return JSON.parse(cached.toString());
      }
    }
    const response = await generateChatResponse(this.config.openai, messages, [
      "openai/gpt-5-mini",
      "openai/gpt-4.1-mini",
    ] as NonEmpty<Model>);
    const responseMessage: AIChatMessage = {
      role: "assistant",
      body: response,
    };
    if (useCache) {
      const buffer = Buffer.from(JSON.stringify(responseMessage, null, 2));
      await this.config.cache.set(key, buffer, "application/json");
    }
    return responseMessage;
  }

  async fetchUrl(
    options: FetchOptions
  ): Promise<{ statusCode: number; data: string; contentType: string }> {
    if (this.options.verbose) {
      console.info(`Fetch URL ~> ${options.url}`);
    }
    return fetch(options);
  }

  async fetchModerations(input: string): Promise<{
    flagged: boolean;
    reasons: Record<string, number>;
  } | null> {
    return this.config.openai.moderations
      .create({ input })
      .then((result) => {
        const item = result.results[0];
        if (!item) {
          return { flagged: false, reasons: {} };
        }
        const reasons = Object.entries(item.category_scores).reduce<
          Record<string, number>
        >((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
        return { flagged: item.flagged, reasons };
      })
      .catch((err) => {
        console.warn("Failed to fetch moderations", err);
        return null;
      });
  }
}

function applyPronunciations(
  text: string,
  pronunciations: Record<string, string>
) {
  let current = text;
  for (const [key, value] of Object.entries(pronunciations)) {
    if (!key) continue;
    current = current.split(key).join(value);
  }
  return current;
}

export class DefaultStoryServiceProvider extends BaseStoryServiceProvider {}

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

  async generateChat(messages: AIChatMessage[]): Promise<AIChatMessage> {
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
