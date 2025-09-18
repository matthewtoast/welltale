import { revertSession } from "./CheckpointUtils";
import { renderNext, RunnerOptions } from "./LocalRunnerUtils";
import { OP, SeamType } from "./StoryEngine";
import { StoryServiceProvider } from "./StoryServiceProvider";
import { StorySession, StorySource } from "./StoryTypes";

export type CommandResult = {
  handled: boolean;
  seam?: SeamType;
  ops?: OP[];
  addr?: string | null;
};

export async function handleCommand(
  raw: string,
  ctx: {
    session: StorySession;
    sources: StorySource;
    options: RunnerOptions;
    provider: StoryServiceProvider;
    seed: string;
    save: () => void;
  }
): Promise<CommandResult> {
  if (!raw.startsWith("/")) return { handled: false };
  const [cmd, arg] = raw.slice(1).trim().split(/\s+/, 2);
  if (cmd === "revert") {
    const n =
      arg === "last" || arg === undefined
        ? ctx.session.checkpoints.length - 1
        : Number.isNaN(Number(arg))
          ? -1
          : Number(arg);
    const ok = revertSession(ctx.session, n);
    if (!ok) {
      console.warn("Invalid revert index");
      return { handled: true };
    }
    const r = await renderNext(
      null,
      ctx.session,
      ctx.sources,
      { ...ctx.options, seed: ctx.seed },
      ctx.provider
    );
    ctx.save();
    return { handled: true, seam: r.seam, ops: r.ops, addr: r.addr };
  }
  if (cmd === "checkpoints") {
    if (ctx.session.checkpoints.length === 0) {
      console.log("(no checkpoints)");
      return { handled: true };
    }
    for (let i = 0; i < ctx.session.checkpoints.length; i++) {
      const c = ctx.session.checkpoints[i];
      console.log(
        `#${i} turn=${c.turn} cycle=${c.cycle} addr=${c.addr ?? ""} events=${c.events.length}`
      );
    }
    return { handled: true };
  }
  return { handled: false };
}
