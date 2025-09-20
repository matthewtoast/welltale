import { omit } from "lodash";
import { revertSession } from "./CheckpointUtils";
import { renderUntilBlocking, RunnerOptions } from "./LocalRunnerUtils";
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
    const r = await renderUntilBlocking(
      null,
      ctx.session,
      ctx.sources,
      { ...ctx.options, seed: ctx.seed },
      ctx.provider
    );
    ctx.save();
    return { handled: true, seam: r.seam, ops: r.ops, addr: r.addr };
  }

  if (cmd === "session") {
    console.log(
      JSON.stringify(
        omit(ctx.session, "state", "stack", "checkpoints"),
        null,
        2
      )
    );
    return { handled: true };
  }

  if (cmd === "state") {
    console.log(JSON.stringify(ctx.session.state, null, 2));
    return { handled: true };
  }

  if (cmd === "checkpoints") {
    console.log(JSON.stringify(ctx.session.checkpoints, null, 2));
    return { handled: true };
  }

  return { handled: false };
}
