import { WelltaleAdapter, WelltaleState } from "lib/adapters/WelltaleAdapter";
import { walkDirectory } from "lib/FileUtils";
import { Playthru, step } from "lib/StoryRunner";

async function go() {
  const id = "honeytrot";
  const cartridge = await walkDirectory(__dirname + `/fxt/${id}`);
  const adapter = new WelltaleAdapter();
  const playthru: Playthru<WelltaleState> = {
    id: "1",
    engine: "",
    time: Date.now(),
    turn: 0,
    seed: "abc",
    cycle: 0,
    state: {
      section: "main.md",
      cursor: "0.0",
    },
    genie: {},
    beats: [],
  };

  await step({ id, cartridge }, playthru, "", adapter);
}
go();
