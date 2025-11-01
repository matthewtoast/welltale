import { execSync } from "child_process";

import { join } from "path";

const cwd = join(__dirname, "..");

const runs = [
  // { dir: "./fic/test", inp: [] },
  // { dir: "./fic/simple", inp: ["Llama", "exit"] },
  { dir: "./fic/shiritori", inp: [] },
];

async function test() {
  for (const run of runs) {
    const inputArgs =
      run.inp.length > 0 ? run.inp.map((input) => `-i ${input}`).join(" ") : "";

    const cmd =
      `yarn ts ./run/auto --cartridgeDir ${run.dir} ${inputArgs}`.trim();

    execSync(cmd, {
      cwd,
      stdio: "inherit",
    });
  }
}

test();
