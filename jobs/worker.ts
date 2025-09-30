import type { SQSEvent } from "aws-lambda";
import { compileStoryJob } from "../lib/StoryInfraUtils";
import { safeJsonParseTyped } from "./../lib/JSONHelpers";

type Job = { type: "compile"; id: string };

export async function handler(e: SQSEvent) {
  for (const r of e.Records) {
    const s = r.body || "";
    const m = safeJsonParseTyped<Job>(s, (x) => typeof x?.type === "string");
    if (!m) {
      console.warn("invalid json");
      continue;
    }
    if (m.type === "compile") {
      try {
        await compileStoryJob(m.id);
      } catch (err) {
        console.error("Failed to compile story:", err);
      }
      continue;
    }
    console.warn("unknown type");
  }
}
