import chalk from "chalk";
import readline from "readline";
import { CAROT } from "./StoryLocalRunnerUtils";
import { runWithPrefetch } from "./StoryRunnerCorePrefetch";
import { OP, SeamType, StoryAdvanceResult } from "./StoryTypes";

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

export async function instantiateREPL(
  advance: (input: string | null) => Promise<StoryAdvanceResult>,
  render: (ops: OP[]) => Promise<void>,
  save: () => Promise<void>
) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.greenBright(CAROT),
  });
  rl.on("close", () => process.exit(0));
  let awaitingInput = false;
  process.stdin.setEncoding("utf8");
  if (process.stdin.isTTY) {
    process.stdin.resume();
  }
  process.stdin.on("data", (chunk) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString();
    if (!isSkipActive()) return;
    if (!text.includes("\n") && !text.includes("\r")) return;
    triggerSkip();
  });

  let resp = await runWithPrefetch(null, advance, render);
  await save();

  if (resp.seam !== SeamType.INPUT) {
    rl.close();
    return;
  }

  awaitingInput = true;
  rl.prompt();

  rl.on("line", async (raw) => {
    if (!awaitingInput) {
      return;
    }
    awaitingInput = false;
    const fixed = raw.trim();
    try {
      resp = await runWithPrefetch(fixed, advance, render);
      await save();
    } catch (err) {
      console.error(chalk.red(err));
      awaitingInput = true;
      rl.prompt();
      return;
    }

    if (resp.seam === SeamType.INPUT) {
      awaitingInput = true;
      rl.prompt();
      return;
    }
    rl.close();
  });
}
