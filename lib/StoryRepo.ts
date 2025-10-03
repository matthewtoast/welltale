import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Readable } from "stream";
import { s3ObjectExists, uploadBufferToS3 } from "./AWSUtils";
import { toBuffer } from "./BufferUtils";
import { StoryMeta, StorySource } from "./StoryTypes";

export function uploadKey(id: string): string {
  return `stories/${id}/upload.zip`;
}

export function compiledKey(id: string): string {
  return `stories/${id}/compiled.json`;
}

export type StoryRepo = {
  getMeta(id: string): Promise<StoryMeta | null>;
  putMeta(meta: StoryMeta): Promise<StoryMeta>;
  listMetas(): Promise<StoryMeta[]>;
  putCompiled(id: string, data: StorySource): Promise<void>;
  getCompiled(id: string): Promise<StorySource | null>;
};

export function createStoryRepo(input: {
  ddb: DynamoDBClient;
  tableName: string;
  s3: S3Client;
  bucketName: string;
}): StoryRepo {
  const { ddb, tableName, s3, bucketName } = input;

  async function getMeta(id: string): Promise<StoryMeta | null> {
    const res = await ddb.send(
      new GetItemCommand({ TableName: tableName, Key: marshall({ id }) })
    );
    if (!res.Item) return null;
    return unmarshall(res.Item) as StoryMeta;
  }

  async function putMeta(meta: StoryMeta): Promise<StoryMeta> {
    await ddb.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(meta, { removeUndefinedValues: true }),
      })
    );
    return meta;
  }

  async function listMetas(): Promise<StoryMeta[]> {
    const res = await ddb.send(new ScanCommand({ TableName: tableName }));
    const items = res.Items || [];
    return items.map((it) => unmarshall(it) as StoryMeta);
  }

  async function putCompiled(id: string, data: StorySource): Promise<void> {
    const k = compiledKey(id);
    const buf = Buffer.from(JSON.stringify(data));
    console.log(`repo:putCompiled ${id} key:${k} bytes:${buf.byteLength}`);
    await uploadBufferToS3({
      client: s3,
      bucket: bucketName,
      key: k,
      data: buf,
      contentType: "application/json",
      fallbackFileName: "compiled.json",
    });
    console.log(`repo:putCompiled:done ${id}`);
  }

  async function getCompiled(id: string): Promise<StorySource | null> {
    const k = compiledKey(id);
    console.log(`repo:getCompiled ${id} key:${k}`);
    const ok = await s3ObjectExists(s3, bucketName, k);
    if (!ok) {
      console.warn(`repo:getCompiled:missing ${id}`);
      return null;
    }
    const res = await s3.send(
      new GetObjectCommand({ Bucket: bucketName, Key: k })
    );
    const buf = await toBuffer(res.Body as Readable);
    console.log(`repo:getCompiled:read ${id} bytes:${buf.byteLength}`);
    return JSON.parse(buf.toString());
  }

  return { getMeta, putMeta, listMetas, putCompiled, getCompiled };
}
