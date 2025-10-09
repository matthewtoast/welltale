import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadDevEnv } from "../env/env-dev";
import { assignInput } from "../lib/StoryConstants";
import {
  LocalStoryRunnerOptions,
  terminalRenderOps,
} from "../lib/StoryLocalRunnerUtils";
import { instantiateREPL } from "../lib/StoryREPLUtils";
import {
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  OP,
  StoryAdvanceResult,
} from "../lib/StoryTypes";
import { apiAdvanceStory, apiFetchDevSessions } from "../lib/StoryWebAPI";
import { cleanSplit } from "../lib/TextHelpers";

const devEnv = loadDevEnv();

async function go() {
  const argv = await yargs(hideBin(process.argv))
    .option("storyId", {
      type: "string",
      description: "Id of story to run",
      demandOption: true,
    })
    .option("seed", {
      type: "string",
      description: "Seed for random number generator",
      default: "seed",
    })
    .option("verbose", {
      type: "boolean",
      description: "Verbose logging",
      default: true,
    })
    .option("doPlayMedia", {
      type: "boolean",
      description: "Play audio files true/false",
      default: true,
    })
    .option("doGenerateAudio", {
      type: "boolean",
      description: "Generate other audio",
      default: true,
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  const devSessions = await apiFetchDevSessions(
    devEnv.WELLTALE_API_BASE,
    cleanSplit(devEnv.DEV_API_KEYS, ",")
  );

  if (devSessions.length < 1) {
    throw new Error("could not start session");
  }

  const { token: sessionToken } = devSessions[0];

  const runnerOptions: LocalStoryRunnerOptions = {
    seed: argv.seed,
    verbose: argv.verbose,
    ream: 100,
    loop: 0,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateImage: false,
    models: DEFAULT_LLM_SLUGS,
    doGenerateAudio: argv.doGenerateAudio,
    doPlayMedia: argv.doPlayMedia,
  };

  const session = createDefaultSession("dev");
  async function render(ops: OP[]): Promise<void> {
    await terminalRenderOps(ops, runnerOptions);
  }
  async function save() {}
  async function advance(input: string | null): Promise<StoryAdvanceResult> {
    assignInput(session, input);
    const result = await apiAdvanceStory(
      devEnv.WELLTALE_API_BASE,
      argv.storyId!,
      session,
      runnerOptions,
      sessionToken
    );
    if (!result) {
      throw new Error("null result from API");
    }
    Object.assign(session, result.session);
    return result;
  }
  await instantiateREPL(advance, render, save);
}

go();
