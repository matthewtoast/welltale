import chalk from "chalk";
import readline from "readline";
import { CAROT } from "../lib/LocalRunnerUtils";
import { isSkipActive, triggerSkip } from "../lib/SkipSignal";
import { runWithPrefetch } from "../lib/StoryRunnerCore";
import { OP, SeamType } from "./../lib/StoryEngine";
import { StoryAdvanceResult } from "./StoryTypes";

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
      console.log(chalk.greenBright(`${CAROT}${fixed}`));
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
