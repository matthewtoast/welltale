import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { OpenAI } from "openai";
import { TSerial } from "../typings";
import { Cache } from "./Cache";
import {
  autoFindVoice,
  composeTrack,
  generateSoundEffect,
  generateSpeechClip,
  generateVoiceFromPrompt,
} from "./ElevenLabsUtils";
import { fetch, FetchOptions } from "./HTTPHelpers";
import type { AIChatMessage, UsageSink } from "./OpenRouterUtils";
import {
  generateChatResponse,
  generateImage,
  generateJson,
  generateJsonWithWeb,
  generateText,
  moderateInput,
} from "./OpenRouterUtils";
import type {
  BaseGenerateOptions,
  GenerateImageOptions,
  GenerateTextCompletionOptions,
  ModerateOptions,
  SpeechSpec,
  StoryServiceProvider,
} from "./StoryServiceProvider";
import type { VoiceSpec } from "./StoryTypes";
import { generatePredictableKey, parameterize } from "./TextHelpers";
import {
  CostKind,
  CostTracker,
  makeTokenCostEntry,
} from "./MeteringUtils";

export abstract class BaseStoryServiceProvider implements StoryServiceProvider {
  protected costTracker: CostTracker | null = null;

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

  attachCostTracker(tracker: CostTracker | null) {
    this.costTracker = tracker;
  }

  protected usageSink(kind: CostKind): UsageSink | null {
    if (!this.costTracker) {
      return null;
    }
    const tracker = this.costTracker;
    return (info) => {
      if (!info.usage) {
        return;
      }
      tracker.add(
        makeTokenCostEntry(kind, info.model, {
          promptTokens: info.usage.promptTokens,
          completionTokens: info.usage.completionTokens,
          totalTokens: info.usage.totalTokens,
        })
      );
    };
  }

  async generateText(
    prompt: string,
    options: GenerateTextCompletionOptions
  ): Promise<string> {
    const useCache = !this.options.disableCache && !options.disableCache;
    const idemp = `${JSON.stringify(options.models)}:${parameterize(prompt)}`;
    if (this.options.verbose) {
      console.info(`Generate Text ~> ${prompt}`);
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
      options.models,
      this.usageSink("llm")
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
      console.info(`Generate JSON ~> ${prompt}`);
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
          options.models,
          this.usageSink("llm")
        )
      : await generateJson(
          this.config.openai,
          prompt,
          JSON.stringify(schema),
          options.models,
          this.usageSink("llm")
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
      console.info(`Generate Sound ~> ${prompt}`);
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
      console.info(`Generate Music ~> ${prompt}`);
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
      console.info(`Generate Speech ~> ${spec.body}`);
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
      console.info(`Generate Voice ~> ${prompt}`);
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

  async generateImage(
    prompt: string,
    options: GenerateImageOptions
  ): Promise<{ url: string }> {
    const useCache = !this.options.disableCache && !options.disableCache;
    const idemp = `${prompt}:${options.model}:${options.aspectRatio || ""}`;
    if (this.options.verbose) {
      console.info(`Generate Image ~> ${prompt}`);
    }
    const key = generatePredictableKey("img", idemp, "png");
    if (useCache) {
      const cached = await this.config.cache.get(key);
      if (cached) {
        const url = await this.config.cache.set(key, cached, "image/png");
        return { url };
      }
    }
    const result = await generateImage(
      this.config.openai,
      prompt,
      options.model,
      options.aspectRatio
    );
    if (!result || !result.images || result.images.length === 0) {
      console.warn("Failed to generate image");
      return { url: "" };
    }
    const firstImage = result.images[0];
    if (!firstImage?.image_url?.url) {
      console.warn("Invalid image response format");
      return { url: "" };
    }
    const dataUrl = firstImage.image_url.url;
    if (!dataUrl.startsWith("data:image/")) {
      console.warn("Invalid image data URL format");
      return { url: "" };
    }
    const base64Data = dataUrl.split(",")[1];
    if (!base64Data) {
      console.warn("Invalid base64 image data");
      return { url: "" };
    }
    const imageBuffer = Buffer.from(base64Data, "base64");
    const url = await this.config.cache.set(key, imageBuffer, "image/png");
    return { url };
  }

  async generateChat(
    messages: AIChatMessage[],
    options: GenerateTextCompletionOptions
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
    const response = await generateChatResponse(
      this.config.openai,
      messages,
      options.models,
      this.usageSink("llm")
    );
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

  async moderateInput(input: string, options: ModerateOptions) {
    const res = await moderateInput(
      this.config.openai,
      input,
      options.models,
      options.threshold,
      this.usageSink("llm")
    ).catch((err) => {
      console.warn("Failed to run moderation", err);
      return null;
    });
    return res;
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
