import { SeamType } from "./StoryEngine";
import { StoryAdvanceResult } from "./StoryTypes";

type Resolver = (result: StoryAdvanceResult | null) => void;

export type StoryStream = {
  push(input: string | null): void;
  take(): Promise<StoryAdvanceResult | null>;
  close(): void;
};

export function createStoryStream(
  advance: (input: string | null) => Promise<StoryAdvanceResult>
): StoryStream {
  const inputs: Array<string | null> = [];
  const ready: StoryAdvanceResult[] = [];
  const waiters: Resolver[] = [];
  let running = false;
  let closed = false;
  let blocked = true;

  function emit(result: StoryAdvanceResult) {
    const next = waiters.shift();
    if (next) {
      next(result);
      return;
    }
    ready.push(result);
  }

  function drain() {
    while (waiters.length) {
      const next = waiters.shift();
      if (!next) continue;
      next(null);
    }
  }

  async function run() {
    if (running || closed) return;
    running = true;
    while (!closed) {
      if (blocked && inputs.length === 0) break;
      const nextInput = inputs.length > 0 ? (inputs.shift() ?? null) : null;
      try {
        const result = await advance(nextInput);
        emit(result);
        if (result.seam === SeamType.MEDIA || result.seam === SeamType.GRANT) {
          blocked = false;
          continue;
        }
        blocked = true;
        break;
      } catch (err) {
        console.warn(err);
        blocked = true;
        closed = true;
        drain();
        break;
      }
    }
    running = false;
    if (!closed && inputs.length > 0 && !running) {
      run();
    }
  }

  function push(input: string | null) {
    if (closed) return;
    inputs.push(input);
    blocked = false;
    run();
  }

  function take(): Promise<StoryAdvanceResult | null> {
    if (ready.length > 0) {
      return Promise.resolve(ready.shift() ?? null);
    }
    if (closed) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      waiters.push(resolve);
    });
  }

  function close() {
    if (closed) return;
    closed = true;
    inputs.length = 0;
    drain();
  }

  return { push, take, close };
}
