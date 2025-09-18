import { SeamType } from "./StoryEngine";

export type LoopLimitOptions = {
  limit: number;
  windowMs: number;
};

export type LoopGuardOptions = {
  short?: LoopLimitOptions;
  long?: LoopLimitOptions;
};

export type LoopGuardDecision = {
  stop: boolean;
  reason?: string;
  kind?: "short" | "long";
  count?: number;
};

export type LoopGuard = {
  record(resp: { seam: SeamType; addr: string | null }): LoopGuardDecision;
  reset(): void;
};

const LOOP_ERROR_NAME = "LoopDetectedError";

export type LoopError = Error & { loop: LoopGuardDecision };

export function isLoopError(err: unknown): err is LoopError {
  return (
    err instanceof Error &&
    err.name === LOOP_ERROR_NAME &&
    typeof (err as Partial<LoopError>).loop !== "undefined"
  );
}

export function createLoopError(decision: LoopGuardDecision): LoopError {
  const reason = decision.reason ?? "Loop guard triggered";
  const err = new Error(reason) as LoopError;
  err.name = LOOP_ERROR_NAME;
  err.loop = decision;
  return err;
}

export function createLoopGuard(options: LoopGuardOptions): LoopGuard {
  const history: { addr: string | null; at: number }[] = [];
  const maxWindow = Math.max(
    options.short?.windowMs ?? 0,
    options.long?.windowMs ?? 0
  );

  function reset() {
    history.length = 0;
  }

  function prune(now: number) {
    if (maxWindow <= 0) {
      if (history.length > 1024) {
        history.splice(0, history.length - 1024);
      }
      return;
    }
    let dropIndex = 0;
    while (dropIndex < history.length) {
      if (now - history[dropIndex].at <= maxWindow) break;
      dropIndex += 1;
    }
    if (dropIndex > 0) {
      history.splice(0, dropIndex);
    }
  }

  function shouldStopShort(
    now: number,
    addr: string | null
  ): LoopGuardDecision | null {
    const cfg = options.short;
    if (!cfg || cfg.limit <= 0 || cfg.windowMs <= 0 || !addr) {
      return null;
    }
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (now - entry.at > cfg.windowMs) break;
      if (entry.addr === addr) {
        count += 1;
        if (count >= cfg.limit) {
          return {
            stop: true,
            reason: `Address ${addr} repeated ${count} times in ${cfg.windowMs}ms`,
            kind: "short",
            count,
          };
        }
      }
    }
    return null;
  }

  function shouldStopLong(now: number): LoopGuardDecision | null {
    const cfg = options.long;
    if (!cfg || cfg.limit <= 0 || cfg.windowMs <= 0) {
      return null;
    }
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (now - entry.at > cfg.windowMs) break;
      count += 1;
      if (count >= cfg.limit) {
        return {
          stop: true,
          reason: `Loop exceeded ${cfg.limit} steps in ${cfg.windowMs}ms`,
          kind: "long",
          count,
        };
      }
    }
    return null;
  }

  function record(resp: { seam: SeamType; addr: string | null }): LoopGuardDecision {
    if (resp.seam === SeamType.INPUT) {
      reset();
      return { stop: false };
    }
    if (resp.seam === SeamType.ERROR || resp.seam === SeamType.FINISH) {
      reset();
      return { stop: false };
    }
    const now = Date.now();
    history.push({ addr: resp.addr, at: now });
    const shortHit = shouldStopShort(now, resp.addr);
    if (shortHit) {
      return shortHit;
    }
    const longHit = shouldStopLong(now);
    if (longHit) {
      return longHit;
    }
    prune(now);
    return { stop: false };
  }

  return { record, reset };
}
