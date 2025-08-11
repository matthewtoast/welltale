import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import { AnyZodObject, z } from "zod";
import { safeJsonParse } from "./JSONHelpers";
import { randAlphaNum } from "./TextHelpers";
import { validShape } from "./ZodHelpers";

export type TOpenAIResponsePayload<T> = {
  id: string;
  model: string;
  error?: {
    message: string;
    type: string;
    param: any;
    code: any;
  };
} & T;

export type TOpenAIModerationCategory =
  | "hate"
  | "hate/threatening"
  | "harassment"
  | "harassment/threatening"
  | "self-harm"
  | "self-harm/intent"
  | "self-harm/instructions"
  | "sexual"
  | "sexual/minors"
  | "violence"
  | "violence/graphic";

export const ZOpenAIChatRoles = z.union([
  z.literal("system"),
  z.literal("user"),
  z.literal("assistant"),
  z.literal("tool"),
]);

export type TOpenAIChatRoles = z.infer<typeof ZOpenAIChatRoles>;

export const ZOpenAIChatMessage = z.object({
  role: ZOpenAIChatRoles,
  content: z.string(),
  parsed: z.any().optional(),
});

export type TOpenAIChatMessage = z.infer<typeof ZOpenAIChatMessage>;

// Updated model types to include the latest models as of June 2025
export type TOpenAIChatLLMs =
  | "gpt-4o-2025-preview"
  | "gpt-4o-2025"
  | "gpt-4o-mini-2025"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4-turbo-2025"
  | "gpt-4-turbo"
  | "gpt-4-vision-2025"
  | "gpt-4-vision";

export interface TOpenAICompletionOptions {
  temperature: number;
  max_tokens: number;
  userId: string | null;
  openaiSecret: string;
  seed?: number;
  response_format?: { type: "json_object" } | { type: "text" };
}

export const DEFAULT_OPENAI_COMPLETION_OPTS = {};

export async function fetchModerations(openai: OpenAI, input: string) {

  const result = await openai.moderations.create({ input });

  const payload = {
    id: result.id,
    model: result.model,
    results: result.results.map((item) => ({
      categories: item.categories,
      category_scores: item.category_scores,
      flagged: item.flagged,
    })),
  } as TOpenAIResponsePayload<{
    results: {
      categories: Record<TOpenAIModerationCategory, boolean>;
      category_scores: Record<TOpenAIModerationCategory, number>;
      flagged: boolean;
    }[];
  }>;

  return payload;
}

export async function fetchChatCompletions(
  openai: OpenAI,
  messages: TOpenAIChatMessage[],
  model: TOpenAIChatLLMs = "gpt-4o",
  options: Partial<TOpenAICompletionOptions> = {},
) {
  const opts = {
    ...DEFAULT_OPENAI_COMPLETION_OPTS,
    ...options,
  };

  // Convert our internal messages format to OpenAI's format
  const apiMessages: ChatCompletionMessageParam[] = messages.map((msg) => {
    if (msg.role === "tool") {
      return {
        role: msg.role,
        content: msg.content,
        tool_call_id: randAlphaNum(),
      };
    }
    return {
      role: msg.role,
      content: msg.content,
    };
  });

  const response = await openai.chat.completions.create({
    model,
    messages: apiMessages,
    user: opts.userId ?? undefined,
    temperature: opts.temperature,
    max_tokens: opts.max_tokens,
    seed: opts.seed,
    response_format: opts.response_format,
  });

  const payload = {
    id: response.id,
    model: response.model,
    object: response.object,
    created: response.created,
    usage: response.usage,
    choices: response.choices.map((choice) => ({
      message: {
        role: choice.message.role as TOpenAIChatRoles,
        content: choice.message.content || "",
        parsed: choice.message.function_call?.arguments
          ? safeJsonParse(choice.message.function_call.arguments)
          : undefined,
      },
      index: choice.index,
      finish_reason: choice.finish_reason,
    })),
  } as TOpenAIResponsePayload<{
    object: string;
    created: number;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    choices: {
      message: TOpenAIChatMessage;
      index: number;
      finish_reason: "stop" | "length" | "content_filter" | null;
    }[];
  }>;

  return payload;
}

export async function fetchCompletionMessage<T extends AnyZodObject>(
  openai: OpenAI,
  prompt: string,
  options: Partial<TOpenAICompletionOptions>,
  model: TOpenAIChatLLMs = "gpt-4o",
  schema?: T,
) {
  const messages: TOpenAIChatMessage[] = [{ role: "user", content: prompt, parsed: undefined }];
  const payload = {
    ...options,
    ...(schema
      ? {
          response_format: { type: "json_object" } as const,
        }
      : {}),
  };

  const completion = await fetchChatCompletions(openai, messages, model, payload);
  if (completion.error) {
    return null;
  }

  return completion.choices[0].message;
}

export async function fetchCompletionText(
  openai: OpenAI,
  prompt: string,
  model: TOpenAIChatLLMs = "gpt-4o",
  options: Partial<TOpenAICompletionOptions> = {},
) {
  const result = (await fetchCompletionMessage(openai, prompt, options, model))?.content;
  return result ?? "";
}

export async function fetchCompletionJson<T>(
  openai: OpenAI,
  prompt: string,
  model: TOpenAIChatLLMs = "gpt-4o",
  schema: AnyZodObject,
): Promise<T | null> {
  let message = await fetchCompletionMessage(openai, prompt, {}, model, schema);
  if (message?.parsed) {
    return validShape<T>(schema as any, message.parsed);
  }
  return message?.content ? validShape<T>(schema as any, safeJsonParse(message.content)) : null;
}

export async function fetchWithWebSearch<T>(openai: OpenAI, prompt: string) {
  const response = await openai.responses.create({
    model: "gpt-4.1",
    tools: [{ type: "web_search_preview" }],
    input: prompt,
  });
  return response.output_text;
}
