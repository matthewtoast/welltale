import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { Responses } from "openai/resources";
import { z } from "zod";

export async function generateText(
  openai: OpenAI,
  prompt: string,
  model: string = "gpt-5",
  options?: {
    temperature?: number;
    max_output_tokens?: number;
    top_p?: number;
    instructions?: string;
    reasoning?: { effort?: "low" | "medium" | "high" };
    service_tier?: "auto" | "default" | "flex" | "priority";
    store?: boolean;
    safety_identifier?: string;
    prompt_cache_key?: string;
    metadata?: Record<string, string>;
  }
): Promise<string | null> {
  const response = await openai.responses.create({
    model,
    input: prompt,
    ...options,
  });

  return response.output_text;
}

export async function generateJson<T>(
  openai: OpenAI,
  prompt:
    | string
    | Array<{
        role: "user" | "assistant" | "system" | "developer";
        content: string;
      }>,
  zodSchema: z.ZodSchema<T>,
  model: string = "gpt-4o-2024-08-06",
  options?: {
    temperature?: number;
    max_output_tokens?: number;
    top_p?: number;
    instructions?: string;
    reasoning?: { effort?: "low" | "medium" | "high" };
    service_tier?: "auto" | "default" | "flex" | "priority";
    store?: boolean;
    safety_identifier?: string;
    prompt_cache_key?: string;
    metadata?: Record<string, string>;
    schemaName?: string;
  }
): Promise<T | null> {
  const response = await openai.responses.parse({
    model,
    input: prompt,
    text: {
      format: zodTextFormat(zodSchema, options?.schemaName || "output"),
    },
    ...options,
  });

  return response.output_parsed;
}

export async function generateFlexibleJson(
  openai: OpenAI,
  prompt: string,
  schema: string,
  model: string = "gpt-4.1",
  options?: {
    temperature?: number;
    max_output_tokens?: number;
    top_p?: number;
    instructions?: string;
    reasoning?: { effort?: "low" | "medium" | "high" };
    service_tier?: "auto" | "default" | "flex" | "priority";
    store?: boolean;
    safety_identifier?: string;
    prompt_cache_key?: string;
    metadata?: Record<string, string>;
  }
): Promise<Record<string, any> | null> {
  const fullPrompt = `${prompt}\n\nReturn JSON matching this structure:\n${schema}\n\nReturn only valid JSON, no other text.`;
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: fullPrompt }],
    response_format: { type: "json_object" },
    ...options,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    console.warn("Failed to parse JSON response from LLM");
    return null;
  }
}

export async function generateChatResponse(
  openai: OpenAI,
  messages: Array<{
    role: "user" | "assistant" | "system" | "developer";
    content: string;
  }>,
  model: string = "gpt-5",
  options?: {
    temperature?: number;
    max_output_tokens?: number;
    top_p?: number;
    instructions?: string;
    reasoning?: { effort?: "low" | "medium" | "high" };
    service_tier?: "auto" | "default" | "flex" | "priority";
    store?: boolean;
    safety_identifier?: string;
    prompt_cache_key?: string;
    metadata?: Record<string, string>;
    tools?: Array<any>;
    tool_choice?:
      | Responses.ToolChoiceOptions
      | Responses.ToolChoiceTypes
      | Responses.ToolChoiceFunction;
    parallel_tool_calls?: boolean;
  }
): Promise<string | null> {
  const response = await openai.responses.create({
    model,
    input: messages,
    ...options,
  });

  return response.output_text;
}
