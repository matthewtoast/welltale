import { ChildProcess, spawn, spawnSync } from "node:child_process";

export type Ctrl = { pid: number; stop: () => void };

const hasFfplay = (() =>
  !spawnSync("ffplay", ["-version"], { stdio: "ignore" }).error)();
export const isFfplayAvailable = (): boolean => hasFfplay;

const buildArgs = (
  src: string,
  o: {
    volume?: number | null;
    fadeOutAt?: number | null;
    fadeOutDur?: number | null;
  }
) => {
  const args = ["-nodisp", "-autoexit", "-loglevel", "quiet"];
  const filters: string[] = [];
  if (typeof o.volume === "number") filters.push(`volume=${o.volume}`);
  if (o.fadeOutDur) {
    const st = o.fadeOutAt ?? 0.01;
    filters.push(`afade=t=out:st=${st}:d=${o.fadeOutDur}`);
    // Stop after fade completes rather than doing full file
    args.push("-t", String(st + o.fadeOutDur));
  }
  if (filters.length) args.push("-af", filters.join(","));
  args.push(src);
  return args;
};

export const playWait = async (
  src: string,
  o: { volume?: number; fadeOutAt?: number; fadeOutDur?: number } = {}
): Promise<void> => {
  if (!hasFfplay) return;
  const child = spawn("ffplay", buildArgs(src, { ...o }), {
    stdio: "ignore",
  });
  await new Promise<void>((res, rej) => {
    child.once("error", rej);
    child.once("exit", () => res());
  });
};

export const play = (
  src: string,
  o: {
    volume?: number;
    loop?: boolean;
    fadeOutAt?: number;
    fadeOutDur?: number;
  } = {}
): Ctrl => {
  if (!hasFfplay) return { pid: -1, stop: () => {} };
  const child: ChildProcess = spawn("ffplay", buildArgs(src, o), {
    stdio: "ignore",
  });
  return { pid: child.pid ?? -1, stop: () => child.kill("SIGINT") };
};
