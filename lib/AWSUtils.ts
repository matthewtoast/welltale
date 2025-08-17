// AWSUtils.ts
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { basename, extname } from "path";

type PutOpts = {
  region: string;
  bucket: string;
  key?: string;
  cacheControl?: string;
  contentType?: string;
};

const EXT: Record<string, string> = {
  ".aac": "audio/aac",
  ".aiff": "audio/aiff",
  ".asf": "video/x-ms-asf",
  ".avi": "video/x-msvideo",
  ".bmp": "image/bmp",
  ".csv": "text/csv; charset=utf-8",
  ".flac": "audio/flac",
  ".gif": "image/gif",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/vnd.microsoft.icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".m4a": "audio/mp4",
  ".m4v": "video/x-m4v",
  ".md": "text/markdown; charset=utf-8",
  ".mid": "audio/midi",
  ".midi": "audio/midi",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".ogv": "video/ogg",
  ".opus": "audio/opus",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".tar": "application/x-tar",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".zip": "application/zip",
};

export const mimeFromPath = (
  path: string,
  fallback = "application/octet-stream"
) => {
  const e = extname(path).toLowerCase();
  return EXT[e] ?? fallback;
};

export const s3PublicUrl = ({
  region,
  bucket,
  key,
}: {
  region: string;
  bucket: string;
  key: string;
}) => {
  const host =
    region === "us-east-1" ? "s3.amazonaws.com" : `s3.${region}.amazonaws.com`;
  const k = key.split("/").map(encodeURIComponent).join("/");
  return `https://${bucket}.${host}/${k}`;
};

const resolveKey = (key: string | undefined, filePath: string) => {
  if (!key || key === "/") return basename(filePath);
  if (key.endsWith("/")) return `${key}${basename(filePath)}`;
  return key.replace(/^\/+/, "");
};

const s3 = (region: string) => new S3Client({ region });

export const uploadBufferToS3 = async ({
  region,
  bucket,
  key,
  cacheControl = "public, max-age=31536000, immutable",
  contentType = "application/octet-stream",
  data,
  fallbackFileName = "file.bin",
}: PutOpts & {
  data: Buffer | Uint8Array | string;
  fallbackFileName?: string;
}) => {
  const Key = resolveKey(key, fallbackFileName);
  const client = s3(region);
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key,
    Body: data,
    ACL: "public-read",
    ContentType: contentType,
    CacheControl: cacheControl,
  });
  const res = await client.send(cmd);
  return {
    key: Key,
    url: s3PublicUrl({ region, bucket, key: Key }),
    etag: res.ETag ?? null,
  };
};

export async function s3ObjectExists(
  region: string,
  bucket: string,
  key: string
): Promise<boolean> {
  const client = new S3Client({ region });
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

export async function getOrCreateObject(
  region: string,
  bucket: string,
  key: string,
  generateContent: () => Promise<Buffer | Uint8Array | string>,
  contentType: string
): Promise<string> {
  const url = s3PublicUrl({ region: region, bucket: bucket, key });
  if (await s3ObjectExists(region, bucket, key)) {
    return url;
  }
  const data = await generateContent();
  await uploadBufferToS3({
    region: region,
    bucket: bucket,
    key,
    data,
    contentType,
  });
  return url;
}
