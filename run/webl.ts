import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadDevEnv } from "../env/env-dev";
import { StoryCoordinatorWeb } from "../lib/engine/StoryCoordinatorWeb";
import {
  LocalStoryRunnerOptions,
  terminalRenderOps,
} from "../lib/engine/StoryLocalRunnerUtils";
import { instantiateREPL } from "../lib/engine/StoryREPLUtils";
import {
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  OP,
  StoryAdvanceResult,
  StoryOptions,
} from "../lib/engine/StoryTypes";
import { apiFetchDevSessions } from "../lib/engine/StoryWebAPI";
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

  const storyOptions: StoryOptions = {
    seed: argv.seed,
    verbose: argv.verbose,
    ream: 100,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    doGenerateImage: false,
    models: DEFAULT_LLM_SLUGS,
    doGenerateAudio: argv.doGenerateAudio,
  };

  const runnerOptions: LocalStoryRunnerOptions = {
    ...storyOptions,
    doPlayMedia: argv.doPlayMedia,
  };

  const emptySource = {
    root: { addr: "", type: "root", atts: {}, kids: [], text: "" },
    voices: {},
    pronunciations: {},
    scripts: {},
    meta: {},
  };

  const session = createDefaultSession("dev", emptySource);

  const coordinator = new StoryCoordinatorWeb(session, storyOptions, {
    apiToken: sessionToken,
    apiBaseUrl: devEnv.WELLTALE_API_BASE,
  });

  async function save() {}

  async function run(input: string | null): Promise<StoryAdvanceResult | null> {
    const result = await coordinator.run(input, async (ops: OP[]) => {
      await terminalRenderOps(ops, runnerOptions);
    });
    return result;
  }

  await instantiateREPL(run, save);
}

go();
