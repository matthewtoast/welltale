import chalk from "chalk";
import readline from "readline";
import { isSkipActive, triggerSkip } from "./SkipHelpers";
import { CAROT } from "./StoryLocalRunnerUtils";
import { OP, SeamType, StoryAdvanceResult } from "./StoryTypes";

export async function instantiateREPL(
  run: (
    input: string | null,
    render: (ops: OP[]) => Promise<void>
  ) => Promise<StoryAdvanceResult | null>,
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

  let resp = await run(null, render);
  if (!resp) {
    throw new Error("Got null response from run()");
  }
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
      resp = await run(fixed, render);
      if (!resp) {
        throw new Error("Got null response from run()");
      }
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
