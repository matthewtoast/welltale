import { WelltaleAdapter } from "lib/adapters/WelltaleAdapter";
import { walkDirectory } from "lib/FileUtils";

async function go() {
  const adapter = new WelltaleAdapter();
  const sources = await adapter.compile(
    await walkDirectory(__dirname + "/fxt/honeytrot")
  );
  console.log(sources[2].stanzas);
}
go();
