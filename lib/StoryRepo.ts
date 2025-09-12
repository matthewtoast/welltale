import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Readable } from "stream";
import { uploadBufferToS3, s3ObjectExists } from "./AWSUtils";
import { toBuffer } from "./BufferUtils";

export type StoryMeta = {
  id: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  publish: "draft" | "published";
  compile: "pending" | "ready";
  createdAt: number;
  updatedAt: number;
};

export function s3(): S3Client {
  return new S3Client({});
}

export function bucket(): string {
  return process.env.STORIES_BUCKET || "";
}

export function ddb(): DynamoDBClient {
  return new DynamoDBClient({});
}

export function table(): string {
  return process.env.STORIES_TABLE || "";
}

export function uploadKey(id: string): string {
  return `stories/${id}/upload.zip`;
}

export function compiledKey(id: string): string {
  return `stories/${id}/compiled.json`;
}

export async function getMeta(id: string): Promise<StoryMeta | null> {
  const c = ddb();
  const t = table();
  const res = await c.send(
    new GetItemCommand({ TableName: t, Key: marshall({ id }) })
  );
  if (!res.Item) return null;
  return unmarshall(res.Item) as StoryMeta;
}

export async function putMeta(m: StoryMeta): Promise<StoryMeta> {
  const c = ddb();
  const t = table();
  await c.send(
    new PutItemCommand({ TableName: t, Item: marshall(m, { removeUndefinedValues: true }) })
  );
  return m;
}

export async function listMetas(): Promise<StoryMeta[]> {
  const c = ddb();
  const t = table();
  const res = await c.send(new ScanCommand({ TableName: t }));
  const items = res.Items || [];
  return items.map((it) => unmarshall(it) as StoryMeta);
}

export async function putCompiled(id: string, data: unknown): Promise<void> {
  const c = s3();
  const b = bucket();
  const k = compiledKey(id);
  const buf = Buffer.from(JSON.stringify(data));
  await uploadBufferToS3({ client: c, bucket: b, key: k, data: buf, contentType: "application/json", fallbackFileName: "compiled.json" });
}

export async function getCompiled(id: string): Promise<unknown | null> {
  const c = s3();
  const b = bucket();
  const k = compiledKey(id);
  const ok = await s3ObjectExists(c, b, k);
  if (!ok) return null;
  const res = await c.send(new GetObjectCommand({ Bucket: b, Key: k }));
  const buf = await toBuffer(res.Body as Readable);
  return JSON.parse(buf.toString());
}
