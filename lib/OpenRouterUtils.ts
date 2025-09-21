import dedent from "dedent";
import OpenAI from "openai";
import { NonEmpty, TSerial } from "../typings";
import { LLM_SLUGS } from "./StoryTypes";

type OpenAIChatModel = (typeof LLM_SLUGS)[number];

export type AIChatMessage = {
  role: "user" | "assistant" | "system" | "developer";
  body: string;
};

const asInput = (p: string | AIChatMessage[]) =>
  typeof p === "string"
    ? [{ role: "user" as const, content: p }]
    : p.map((m) => ({
        role: (m.role === "developer" ? "system" : m.role) as
          | "user"
          | "assistant"
          | "system",
        content: m.body,
      }));

const readText = (r: {
  choices?: Array<{ message?: { content?: string } }>;
}): string => (r.choices ?? []).map((c) => c?.message?.content ?? "").join("");

const addOnline = (s: string, on: boolean) =>
  on ? (s.includes(":online") ? s : `${s}:online`) : s;
const prepRoute = (models: NonEmpty<OpenAIChatModel>, online: boolean) => {
  const route = models.map((m) => addOnline(m, online));
  const [model, ...fallbacks] = route;
  return { model, fallbacks };
};

export async function generateText(
  openai: OpenAI,
  prompt: string,
  useWebSearch = false,
  models: NonEmpty<OpenAIChatModel>
) {
  const { model, fallbacks } = prepRoute(models, useWebSearch);
  const r = await openai.chat.completions.create({
    model,
    messages: asInput(prompt),
    ...(fallbacks.length ? { extra_body: { models: fallbacks } } : {}),
  });
  return readText(r as any);
}

export async function extractJson(
  openai: OpenAI,
  text: string,
  schema: string,
  models: NonEmpty<OpenAIChatModel>
): Promise<Record<string, TSerial>> {
  return generateJson(
    openai,
    dedent`
      Per the given schema, extract structured data from this input:
      <INPUT>
        ${text}
      </INPUT>
    `.trim(),
    schema,
    models
  );
}

export async function generateJsonWithWeb(
  openai: OpenAI,
  prompt: string,
  schema: string,
  models: NonEmpty<OpenAIChatModel>
) {
  return extractJson(
    openai,
    await generateText(openai, prompt, true, models),
    schema,
    models
  );
}

export async function generateJson(
  openai: OpenAI,
  prompt: string,
  schema: string,
  models: NonEmpty<OpenAIChatModel>
): Promise<Record<string, TSerial>> {
  const { model, fallbacks } = prepRoute(models, false);
  const preface = "Return only a JSON object. Follow this schema:\n" + schema;
  const r = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: preface },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" as const },
    ...(fallbacks.length ? { extra_body: { models: fallbacks } } : {}),
  });
  const txt = readText(r as any) || "{}";
  return JSON.parse(txt);
}

export async function generateChatResponse(
  openai: OpenAI,
  messages: AIChatMessage[],
  models: NonEmpty<OpenAIChatModel>
) {
  const { model, fallbacks } = prepRoute(models, true);
  const r = await openai.chat.completions.create({
    model,
    messages: asInput(messages),
    ...(fallbacks.length ? { extra_body: { models: fallbacks } } : {}),
  });
  return readText(r as any);
}

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
