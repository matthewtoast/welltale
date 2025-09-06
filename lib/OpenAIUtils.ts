import dedent from "dedent";
import OpenAI from "openai";
import { TSerial } from "typings";

type Msg = {
  role: "user" | "assistant" | "system" | "developer";
  content: string;
};

const asInput = (p: string | Msg[]) =>
  typeof p === "string"
    ? p
    : p.map((m) => ({
        role: m.role,
        content: [{ type: "input_text" as const, text: m.content }],
      }));

const readText = (r: { output?: unknown }): string => {
  if (!Array.isArray((r as any).output)) return "";
  const items = (r as any).output as Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  return items
    .flatMap((i) => i?.content ?? [])
    .filter((c) => c && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("");
};

export const DEFAULT_MODEL = "gpt-4.1";

export async function generateText(
  openai: OpenAI,
  prompt: string,
  useWebSearch: boolean = false,
  model: string = DEFAULT_MODEL
) {
  const r = await openai.responses.create({
    model,
    input: prompt,
    tools: useWebSearch ? [{ type: "web_search" as const }] : [],
  });
  return readText(r);
}

export async function extractJson(
  openai: OpenAI,
  text: string,
  schema: string,
  model: string = DEFAULT_MODEL
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
    model
  );
}

export async function generateJsonWithWeb(
  openai: OpenAI,
  prompt: string,
  schema: string,
  model: string = DEFAULT_MODEL
) {
  return extractJson(
    openai,
    await generateText(openai, prompt, true /* useWebSearch */, model),
    schema,
    model
  );
}

export async function generateJson(
  openai: OpenAI,
  prompt: string,
  schema: string,
  model: string = DEFAULT_MODEL
): Promise<Record<string, TSerial>> {
  const preface = "Return only a JSON object. Follow this schema:\n" + schema;
  const r = await openai.responses.create({
    model,
    input: [
      { role: "developer", content: [{ type: "input_text", text: preface }] },
      { role: "user", content: [{ type: "input_text", text: prompt }] },
    ],
    text: {
      format: { type: "json_object" },
    },
  });
  const txt = readText(r) || "{}";
  return JSON.parse(txt);
}

export async function generateChatResponse(
  openai: OpenAI,
  messages: Msg[],
  model: string = DEFAULT_MODEL
) {
  const r = await openai.responses.create({
    model,
    input: asInput(messages),
    tools: [{ type: "web_search" as const }],
  });
  return readText(r);
}
