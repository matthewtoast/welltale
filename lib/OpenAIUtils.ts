import OpenAI from "openai";

type Msg = {
  role: "user" | "assistant" | "system" | "developer";
  content: string;
};

const webTool = [{ type: "web_search" as const }];

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

export async function generateText(
  openai: OpenAI,
  prompt: string,
  model: string = "gpt-4.1"
) {
  const r = await openai.responses.create({
    model,
    input: prompt,
    tools: webTool,
  });
  return readText(r);
}

export async function generateFlexibleJson(
  openai: OpenAI,
  prompt: string,
  schema: string,
  model: string = "gpt-4.1"
) {
  const preface = "Return only a JSON object. Follow this schema:\n" + schema;
  const r = await openai.responses.create({
    model,
    input: [
      { role: "developer", content: [{ type: "input_text", text: preface }] },
      { role: "user", content: [{ type: "input_text", text: prompt }] },
    ],
    tools: webTool,
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
  model: string = "gpt-4.1"
) {
  const r = await openai.responses.create({
    model,
    input: asInput(messages),
    tools: webTool,
  });
  return readText(r);
}
