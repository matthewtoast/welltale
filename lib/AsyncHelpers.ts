export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  {
    attempts = 5,
    backoff = (i: number) => 1000 * 2 ** i,
    shouldRetry = (e: any) => e?.name === "InvalidParameterValueException" && /cannot be assumed/.test(e.message),
  }: {
    attempts?: number;
    backoff?: (attempt: number) => number;
    shouldRetry?: (err: any) => boolean;
  } = {},
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!shouldRetry(err) || i === attempts - 1) throw err;
      lastErr = err;
      await sleep(backoff(i));
    }
  }
  throw lastErr;
}
