/**
 * HTTP utility functions for fetching and manipulating data from URLs
 */

/**
 * Downloads data from a URL and returns it as a Buffer
 *
 * @param url - The URL to fetch data from
 * @param options - Optional fetch options
 * @returns A promise that resolves to a Buffer containing the downloaded data
 * @throws Error if the fetch fails or if the response is not OK
 */
export async function urlToBuffer(
  url: string,
  options?: RequestInit
): Promise<Buffer> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(
        `HTTP error! Status: ${response.status} ${response.statusText}`
      );
    }

    // Get the response as an ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    // Convert ArrayBuffer to Buffer
    return Buffer.from(arrayBuffer);
  } catch (error) {
    // Add context to the error
    const errorMessage =
      error instanceof Error
        ? `Failed to download from URL: ${error.message}`
        : `Failed to download from URL: ${String(error)}`;

    throw new Error(errorMessage);
  }
}

/**
 * Downloads data from a URL and returns it as a Buffer, with retry logic
 *
 * @param url - The URL to fetch data from
 * @param options - Optional configuration
 * @returns A promise that resolves to a Buffer containing the downloaded data
 * @throws Error if all retry attempts fail
 */
export async function urlToBufferWithRetry(
  url: string,
  options?: {
    fetchOptions?: RequestInit;
    retries?: number;
    delayMs?: number;
  }
): Promise<Buffer> {
  const { fetchOptions, retries = 3, delayMs = 1000 } = options || {};

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await urlToBuffer(url, fetchOptions);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't wait on the last attempt
      if (attempt < retries) {
        // Wait with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt))
        );
      }
    }
  }

  // If we get here, all attempts failed
  throw (
    lastError ||
    new Error(`Failed to download from URL after ${retries} attempts`)
  );
}

const TEXT_FILE_TYPES = [
  "txt",
  "json",
  "ink",
  "svg",
  "html",
  "json",
  "xml",
  "csv",
  "js",
  "css",
  "jsonl",
];

export function isTextFileType(format: string) {
  return TEXT_FILE_TYPES.includes(format.toLowerCase());
}

export function filenameToContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    case "tiff":
    case "tif":
      return "image/tiff";
    case "ico":
      return "image/x-icon";
    case "avif":
      return "image/avif";
    case "heic":
    case "heif":
      return "image/heic";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
    case "xml":
      return "application/xml";
    case "csv":
      return "text/csv";
    case "zip":
      return "application/zip";
    case "tar":
    case "gz":
      return "application/gzip";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "mp4":
    case "m4a":
      return "video/mp4";
    case "avi":
      return "video/x-msvideo";
    case "mov":
      return "video/quicktime";
    case "js":
      return "application/javascript";
    case "css":
      return "text/css";
    case "html":
      return "text/html";
    case "md":
      return "text/markdown";
    case "yaml":
    case "yml":
      return "application/x-yaml";
    case "woff":
    case "woff2":
      return "font/woff";
    case "ttf":
      return "font/ttf";
    case "eot":
      return "application/vnd.ms-fontobject";
    case "otf":
      return "font/otf";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}
