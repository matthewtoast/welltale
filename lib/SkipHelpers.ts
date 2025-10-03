const ctrls = new Set<AbortController>();

export type SkipHandle = { signal: AbortSignal; release: () => void };

export function createSkipHandle(): SkipHandle {
  const ctrl = new AbortController();
  ctrls.add(ctrl);
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    ctrl.signal.removeEventListener("abort", release);
    ctrls.delete(ctrl);
  };
  ctrl.signal.addEventListener("abort", release, { once: true });
  return { signal: ctrl.signal, release };
}

export function triggerSkip(): void {
  if (!ctrls.size) return;
  for (const ctrl of Array.from(ctrls)) {
    ctrl.abort();
  }
}

export function isSkipActive(): boolean {
  return ctrls.size > 0;
}

export async function runWithSkip<T>(
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const h = createSkipHandle();
  const p = fn(h.signal);
  return p.finally(() => h.release());
}
