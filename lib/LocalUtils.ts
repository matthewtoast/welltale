import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { sleep } from "lib/AsyncHelpers";
import { loadEnv } from "lib/DotEnv";
import { safeJsonParse } from "lib/JSONHelpers";
import { ServiceProvider } from "lib/ServiceProvider";
import { compileStory } from "lib/StoryCompiler";
import {
  advanceStory,
  createDefaultSession,
  FALLBACK_SPEAKER,
  SeamType,
  Session,
  Story,
  StoryOptions,
} from "lib/StoryEngine";
import { isBlank, railsTimestamp } from "lib/TextHelpers";
import { dirname } from "path";

export const CAROT = "> ";

loadEnv();

export function loadSessionFromDisk(abspath: string, id?: string): Session {
  if (isBlank(id)) {
    id = railsTimestamp();
  }
  const fallback = createDefaultSession(id!);
  const dir = dirname(abspath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(abspath)) {
    writeFileSync(abspath, "{}");
  }
  let json = safeJsonParse(readFileSync(abspath).toString()) ?? {};
  if (typeof json !== "object") {
    json = {};
  }
  return {
    ...fallback,
    ...json,
  };
}

export function saveSessionToDisk(state: Session, abspath: string) {
  writeFileSync(abspath, JSON.stringify(state, null, 2));
}

export async function renderNext(
  input: string,
  session: Session,
  story: Story,
  options: StoryOptions,
  provider: ServiceProvider
) {
  if (!isBlank(input)) {
    console.log(chalk.greenBright(`${CAROT}${input}`));
    if (!session.input) {
      session.input = {
        atts: {},
        body: input,
      };
    } else {
      session.input.body = input;
    }
  }
  const root = await compileStory(story.cartridge);
  const { ops, seam, info } = await advanceStory(
    provider,
    root,
    session,
    options
  );
  async function render() {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      switch (op.type) {
        case "get-input":
          break;
        case "play-event":
          console.log(
            chalk.cyan.bold(`${op.event.from || FALLBACK_SPEAKER}:`) +
              " " +
              chalk.cyan(`${op.event.body}`)
          );
          break;
        case "story-end":
          console.log(chalk.magenta("The end."));
          return "halt";
        case "play-media":
          // no-op in REPL mode
          break;
        case "sleep":
          console.log(chalk.yellow.italic(`[waiting ${op.duration} ms]`));
          await sleep(op.duration);
          break;
      }
    }
  }
  await render();
  return seam;
}

export async function runUntilComplete(
  info: {
    options: StoryOptions;
    provider: ServiceProvider;
    session: Session;
    story: Story;
    seed: string;
    inputs: string[];
  },
  seam: SeamType = SeamType.GRANT
) {
  if (seam === SeamType.INPUT) {
    const input = info.inputs.shift();
    if (input) {
      seam = await renderNext(
        input,
        info.session,
        info.story,
        { ...info.options, seed: info.seed },
        info.provider
      );
      return runUntilComplete(info, seam);
    }
  } else if (seam === SeamType.GRANT) {
    seam = await renderNext(
      "",
      info.session,
      info.story,
      { ...info.options, seed: info.seed },
      info.provider
    );
    return runUntilComplete(info, seam);
  }
  return seam;
}
