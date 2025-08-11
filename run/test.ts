import { readFileSync } from "fs";
import { WelltaleAdapter } from "lib/adapters/WelltaleAdapter";

const adapter = new WelltaleAdapter();
adapter.compile({
  "mo.md": readFileSync(__dirname + "/fxt/ex.md"),
});
