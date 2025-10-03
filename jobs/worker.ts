import type { SQSEvent } from "aws-lambda";
import { compileStoryJob } from "../lib/StoryInfraUtils";
import { safeJsonParseTyped } from "./../lib/JSONHelpers";

console.info("[worker] job:loaded");

type Job = { type: "compile"; id: string };

export async function handler(e: SQSEvent) {
  console.info("[worker] job:handler");
  for (const r of e.Records) {
    console.info(`[worker] job:record ${r.messageId}`);
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
