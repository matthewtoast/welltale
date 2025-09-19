import { renderNext, RenderResult } from "./RunnerCore";
import { SeamType } from "./StoryEngine";
import { StoryServiceProvider } from "./StoryServiceProvider";
import { StoryOptions, StorySession, StorySource } from "./StoryTypes";

type StreamState = {
  session: StorySession;
  sources: StorySource;
  options: StoryOptions;
  provider: StoryServiceProvider;
};

type Resolver = (result: RenderResult | null) => void;

export type StoryStream = {
  push(input: string | null): void;
  take(): Promise<RenderResult | null>;
  close(): void;
};

export function createStoryStream(state: StreamState): StoryStream {
  const inputs: Array<string | null> = [];
  const ready: RenderResult[] = [];
  const waiters: Resolver[] = [];
  let running = false;
  let closed = false;
  let blocked = true;

  function emit(result: RenderResult) {
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
      const nextInput = inputs.length > 0 ? inputs.shift() ?? null : null;
      try {
        const result = await renderNext(
          nextInput,
          state.session,
          state.sources,
          state.options,
          state.provider
        );
        emit(result);
        if (
          result.seam === SeamType.MEDIA ||
          result.seam === SeamType.GRANT
        ) {
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

  function take(): Promise<RenderResult | null> {
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
