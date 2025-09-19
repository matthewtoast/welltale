export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((res) => setTimeout(res, ms));
  if (signal.aborted) return Promise.resolve();
  return new Promise((res) => {
    let timeout: NodeJS.Timeout;
    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      res();
    };
    const onDone = () => {
      signal.removeEventListener("abort", onAbort);
      res();
    };
    timeout = setTimeout(onDone, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
