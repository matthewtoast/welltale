import dedent from "dedent";
import OpenAI from "openai";
import { NonEmpty, TSerial } from "typings";

export const MODELS = [
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "openai/gpt-4o",
  "anthropic/claude-3.5-sonnet",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-v3.1",
  "mistralai/mistral-large",
  "meta-llama/llama-3.1-70b-instruct",
] as const;

type Model = (typeof MODELS)[number];

type Msg = {
  role: "user" | "assistant" | "system" | "developer";
  content: string;
};

const asInput = (p: string | Msg[]) =>
  typeof p === "string"
    ? [{ role: "user" as const, content: p }]
    : p.map((m) => ({
        role: (m.role === "developer" ? "system" : m.role) as
          | "user"
          | "assistant"
          | "system",
        content: m.content,
      }));

const readText = (r: {
  choices?: Array<{ message?: { content?: string } }>;
}): string => (r.choices ?? []).map((c) => c?.message?.content ?? "").join("");

const addOnline = (s: string, on: boolean) =>
  on ? (s.includes(":online") ? s : `${s}:online`) : s;
const prepRoute = (models: NonEmpty<Model>, online: boolean) => {
  const route = models.map((m) => addOnline(m, online));
  const [model, ...fallbacks] = route;
  return { model, fallbacks };
};

export async function generateText(
  openai: OpenAI,
  prompt: string,
  useWebSearch = false,
  models: NonEmpty<Model>
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
  models: NonEmpty<Model>
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
  models: NonEmpty<Model>
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
  models: NonEmpty<Model>
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
  messages: Msg[],
  models: NonEmpty<Model>
) {
  const { model, fallbacks } = prepRoute(models, true);
  const r = await openai.chat.completions.create({
    model,
    messages: asInput(messages),
    ...(fallbacks.length ? { extra_body: { models: fallbacks } } : {}),
  });
  return readText(r as any);
}
