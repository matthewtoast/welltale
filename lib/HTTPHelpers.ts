import axios, { AxiosRequestConfig, Method } from "axios";
import xml2js from "xml2js";

export interface FetchOptions {
  url: string;
  method?: Method;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export async function fetchWithParse<T = any>(
  options: FetchOptions
): Promise<T> {
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

  if (contentType.includes("application/json")) {
    return JSON.parse(response.data);
  }

  if (
    contentType.includes("application/xml") ||
    contentType.includes("text/xml")
  ) {
    const parser = new xml2js.Parser({ explicitArray: false });
    return parser.parseStringPromise(response.data);
  }

  // Return raw response for other types
  return response.data;
}
