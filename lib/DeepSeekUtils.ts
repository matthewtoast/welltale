import { AnyZodObject, z } from "zod";
import "./DotEnv";
import { safeJsonParse } from "./JSONHelpers";
import { validShape } from "./ZodHelpers";

// Initialize DeepSeek client settings
// DeepSeek's API is designed to be compatible with OpenAI's API
const DEEPSEEK_API_BASE = "https://api.deepseek.com/v1";

export type TDeepSeekResponsePayload<T> = {
  id: string;
  model: string;
  error?: {
    message: string;
    type: string;
    param: any;
    code: any;
  };
} & T;

export const ZDeepSeekChatRoles = z.union([z.literal("system"), z.literal("user"), z.literal("assistant")]);

export type TDeepSeekChatRoles = z.infer<typeof ZDeepSeekChatRoles>;

export const ZDeepSeekChatMessage = z.object({
  role: ZDeepSeekChatRoles,
  content: z.string(),
  parsed: z.any().optional(),
});

export type TDeepSeekChatMessage = z.infer<typeof ZDeepSeekChatMessage>;

// Current DeepSeek model types
export type TDeepSeekLLMs = "deepseek-chat" | "deepseek-chat-v2" | "deepseek-coder" | "deepseek-lite" | "deepseek-math" | "deepseek-vision";

export interface TDeepSeekCompletionOptions {
  temperature?: number;
  max_tokens?: number;
  userId?: string | null;
  apiKey?: string;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  seed?: number;
}

export interface DeepSeekChatCompletionRequest {
  model: TDeepSeekLLMs;
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  seed?: number;
  user?: string | null;
  [key: string]: any;
}

export interface DeepSeekChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      function_call?: {
        name: string;
        arguments: string;
      };
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const DEFAULT_DEEPSEEK_COMPLETION_OPTS: TDeepSeekCompletionOptions = {
  temperature: 0.7,
  max_tokens: 1000,
};

function makeHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export async function fetchDeepSeekChatCompletions(messages: TDeepSeekChatMessage[], model: TDeepSeekLLMs = "deepseek-chat", options: TDeepSeekCompletionOptions = {}) {
  const opts = {
    ...DEFAULT_DEEPSEEK_COMPLETION_OPTS,
    ...options,
  };

  const apiKey = opts.apiKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DeepSeek API key is required. Set DEEPSEEK_API_KEY environment variable or pass apiKey in options.");
  }

  // Format messages for DeepSeek API
  const formattedMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const requestBody: DeepSeekChatCompletionRequest = {
    model,
    messages: formattedMessages,
    temperature: opts.temperature,
    max_tokens: opts.max_tokens,
    top_p: opts.top_p,
    frequency_penalty: opts.frequency_penalty,
    presence_penalty: opts.presence_penalty,
    stop: opts.stop,
    seed: opts.seed,
    user: opts.userId,
  };

  // Remove undefined properties
  Object.keys(requestBody).forEach((key) => {
    if (requestBody[key] === undefined) {
      delete requestBody[key];
    }
  });

  try {
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
      method: "POST",
      headers: makeHeaders(apiKey),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        id: "",
        model,
        error: {
          message: error.message || "Unknown error occurred",
          type: error.type || "api_error",
          param: error.param,
          code: error.code,
        },
      } as TDeepSeekResponsePayload<any>;
    }

    const data = (await response.json()) as DeepSeekChatResponse;

    const payload = {
      id: data.id,
      model: data.model,
      object: data.object,
      created: data.created,
      usage: data.usage,
      choices: data.choices.map((choice) => ({
        message: {
          role: choice.message.role as TDeepSeekChatRoles,
          content: choice.message.content || "",
          parsed: choice.message.function_call?.arguments ? safeJsonParse(choice.message.function_call.arguments) : undefined,
        },
        index: choice.index,
        finish_reason: choice.finish_reason,
      })),
    } as TDeepSeekResponsePayload<{
      object: string;
      created: number;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      choices: {
        message: TDeepSeekChatMessage;
        index: number;
        finish_reason: string;
      }[];
    }>;

    return payload;
  } catch (error) {
    console.error("Error calling DeepSeek API:", error);
    return {
      id: "",
      model,
      error: {
        message: error instanceof Error ? error.message : "Unknown error occurred",
        type: "api_error",
        param: null,
        code: null,
      },
    } as TDeepSeekResponsePayload<any>;
  }
}

export async function fetchCompletionMessage<T extends AnyZodObject>(prompt: string, options: TDeepSeekCompletionOptions = {}, model: TDeepSeekLLMs = "deepseek-chat", schema?: T) {
  const messages: TDeepSeekChatMessage[] = [{ role: "user", content: prompt, parsed: undefined }];

  // If we have a schema, we need to add a system message to request JSON output
  if (schema) {
    messages.unshift({
      role: "system",
      content: "You must respond with a valid JSON object that follows the requested schema. Your entire response must be valid JSON, with no other text before or after.",
      parsed: undefined,
    });
  }

  const completion = await fetchDeepSeekChatCompletions(messages, model, options);
  if (completion.error) {
    return null;
  }

  return completion.choices[0].message;
}

export async function fetchCompletionText(prompt: string, model: TDeepSeekLLMs = "deepseek-chat", options: TDeepSeekCompletionOptions = {}) {
  const result = (await fetchCompletionMessage(prompt, options, model))?.content;
  return result ?? "";
}

export async function fetchCompletionJson<T>(
  prompt: string,
  schema: AnyZodObject,
  model: TDeepSeekLLMs = "deepseek-chat",
  options: TDeepSeekCompletionOptions = {},
): Promise<T | null> {
  // Enhance the prompt to ensure JSON output
  const enhancedPrompt = `${prompt}\n\nRespond with valid JSON only, following this schema: ${JSON.stringify(schema.shape)}`;

  let message = await fetchCompletionMessage(enhancedPrompt, options, model, schema);

  if (message?.parsed) {
    return validShape<T>(schema as any, message.parsed);
  }

  if (message?.content) {
    try {
      // Try to extract JSON if the model didn't follow instructions perfectly
      const jsonMatch = message.content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : message.content;
      return validShape<T>(schema as any, safeJsonParse(jsonString));
    } catch (error) {
      console.error("Failed to parse JSON from DeepSeek response:", error);
      return null;
    }
  }

  return null;
}
