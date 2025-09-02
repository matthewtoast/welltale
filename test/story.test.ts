import { loadDirRecursive } from "lib/FileUtils";
import { Story } from "lib/StoryEngine";
import { omit } from "lodash";
import { join } from "path";
import {
  defaultRunnerOptions,
  defaultRunnerProvider,
  loadPlaythruFromDisk,
  runUntilComplete,
} from "test/LocalUtils";

const testdir = join(__dirname);
const game = "teststory";

async function go() {
  const cartridge = await loadDirRecursive(
    join(testdir, "fixtures", "cartridges", game)
  );

  const story: Story = { id: game, cartridge };

  const playthru = loadPlaythruFromDisk(
    game,
    join(testdir, "fixtures", "playthrus", `${game}-playthru.json`)
  );

  await runUntilComplete({
    options: defaultRunnerOptions,
    provider: defaultRunnerProvider,
    playthru,
    story,
    seed: game + "1",
    inputs: ["platypus"],
  });

  console.log(omit(playthru, "history"));
}

go();
