import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createProvider } from "../lib/DevProvider";
import { toYaml } from "../lib/JSONHelpers";
import { DEFAULT_LLM_SLUGS } from "../lib/StoryTypes";
import { parameterize } from "../lib/TextHelpers";
import { createWelltaleContent } from "../lib/WelltaleKnowledgeContext";
import { DEFAULT_CACHE_DIR } from "./../lib/LocalCache";

async function runCreate() {
  const argv = await yargs(hideBin(process.argv))
    .option("title", {
      type: "string",
      description: "Story title",
      demandOption: true,
    })
    .option("author", {
      type: "string",
      description: "Author name",
      demandOption: true,
    })
    .option("idea", {
      type: "string",
      description: "Story concept",
      demandOption: true,
    })
    .option("cacheDir", {
      type: "string",
      default: DEFAULT_CACHE_DIR,
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();
  const provider = createProvider();
  const outdir = join(__dirname, "..", `./fic/${[parameterize(argv.title)]}`);
  mkdirSync(outdir, { recursive: true });
  const { data, main } = await createWelltaleContent(
    argv.title,
    argv.author,
    argv.idea,
    provider,
    {
      useWebSearch: false,
      models: DEFAULT_LLM_SLUGS,
    }
  );
  writeFileSync(join(outdir, "data.yml"), toYaml(data));
  writeFileSync(join(outdir, "main.wsl"), main);
}

runCreate();
