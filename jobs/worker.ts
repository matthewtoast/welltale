import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { SQSEvent } from "aws-lambda";
import { toBuffer, unzip } from "lib/BufferUtils";
import { safeJsonParseTyped } from "lib/JSONHelpers";
import { compileStory } from "lib/StoryCompiler";
import { getMeta, putCompiled, putMeta, uploadKey } from "lib/StoryRepo";
import { MockStoryServiceProvider } from "lib/StoryServiceProvider";
import { StoryCartridge } from "lib/StoryTypes";
import { Readable } from "stream";

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
      const b = process.env.STORIES_BUCKET || "";
      if (!b) {
        console.warn("missing bucket");
        continue;
      }
      const c = new S3Client({});
      const key = uploadKey(m.id);
      const obj = await c.send(new GetObjectCommand({ Bucket: b, Key: key }));
      const zip = await toBuffer(obj.Body as Readable);
      const files = await unzip(zip);
      const cart: StoryCartridge = {};
      for (const k of Object.keys(files)) cart[k] = files[k];
      const provider = new MockStoryServiceProvider();
      const compiled = await compileStory(provider, cart, {
        doCompileVoices: false,
      });
      await putCompiled(m.id, compiled);
      const meta = await getMeta(m.id);
      if (meta) {
        meta.compile = "ready";
        meta.updatedAt = Date.now();
        await putMeta(meta);
      }
      continue;
    }
    console.warn("unknown type");
  }
}
