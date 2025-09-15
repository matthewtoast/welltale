import axios, { AxiosRequestConfig, Method } from "axios";

export interface FetchOptions {
  url: string;
  method?: Method;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export async function fetch(
  options: FetchOptions
): Promise<{ statusCode: number; data: string; contentType: string }> {
  const { url, method = "GET", body, headers = {}, timeout = 10000 } = options;
  const config: AxiosRequestConfig = {
    url,
    method,
    headers,
    timeout,
    data: body,
    responseType: "text",
    validateStatus: () => true,
  };
  const response = await axios(config);
  const contentType = response.headers["content-type"] || "";
  return {
    statusCode: response.status,
    data: response.data,
    contentType,
  };
}

export function isValidUrl(s: string): boolean {
  try {
    // Accepts http, https, and protocol-relative URLs
    const urlPattern = /^(https?:\/\/|\/\/)[^\s/$.?#].[^\s]*$/i;
    if (urlPattern.test(s)) {
      new URL(s.startsWith("//") ? "http:" + s : s);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function toHttpMethod(method: string): Method {
  const upper = method.trim().toUpperCase();
  const allowed: Method[] = ["GET", "POST", "PUT", "DELETE"];
  return allowed.includes(upper as any) ? (upper as Method) : "GET";
}
