import { loadDirRecursive } from "lib/FileUtils";
import { Story } from "lib/StoryEngine";
import { join } from "path";
import {
  defaultRunnerOptions,
  defaultRunnerProvider,
  loadPlaythruFromDisk,
  runUntilComplete,
} from "run/RunUtils";

const basedir = join(__dirname, "..");
const game = "teststory";

async function go() {
  const cartridge = await loadDirRecursive(
    join(basedir, "test", "fixtures", game)
  );

  console.log(cartridge);

  const story: Story = { id: game, cartridge };

  const playthru = loadPlaythruFromDisk(
    game,
    join(basedir, "test", "fixtures", "playthrus", `${game}-playthru.json`)
  );

  await runUntilComplete({
    options: defaultRunnerOptions,
    provider: defaultRunnerProvider,
    playthru,
    story,
    seed: game,
    inputs: [],
  });

  console.log(playthru);
}

go();
