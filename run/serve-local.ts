import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import express from "express";
import fs from "fs";
import { glob } from "glob";
import { OpenAI } from "openai";
import os from "os";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";
import { Cache } from "../lib/Cache";
import { LocalCache } from "../lib/LocalCache";
import { BaseServiceProvider } from "../lib/ServiceProvider";
import { compileStory } from "../lib/StoryCompiler";
import {
  advanceStory,
  SessionSchema,
  StoryOptionsSchema,
  type Cartridge,
} from "../lib/StoryEngine";

const RequestSchema = z.object({
  storyId: z.string(),
  session: SessionSchema,
  options: StoryOptionsSchema,
});

class LocalServiceProvider extends BaseServiceProvider {
  private cartridgeDirs: string[];

  constructor(
    config: {
      openai: OpenAI;
      eleven: ElevenLabsClient;
      cache: Cache;
    },
    cartridgeDirs: string[]
  ) {
    super(config);
    this.cartridgeDirs = cartridgeDirs;
  }

  async loadCartridge(storyId: string): Promise<Cartridge> {
    for (const dir of this.cartridgeDirs) {
      const storyPath = path.join(dir, storyId);
      if (fs.existsSync(storyPath) && fs.statSync(storyPath).isDirectory()) {
        const cartridge: Cartridge = {};
        const files = await glob("**/*", {
          cwd: storyPath,
          nodir: true,
        });
        for (const file of files) {
          const fullPath = path.join(storyPath, file);
          const content = fs.readFileSync(fullPath);
          cartridge[file] = content;
        }
        return cartridge;
      }
    }
    throw new Error(`Story '${storyId}' not found in any cartridge directory`);
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("port", {
      type: "number",
      default: 3000,
      description: "Port to run the server on",
    })
    .option("openaiKey", {
      type: "string",
      description: "OpenAI API key",
      demandOption: true,
    })
    .option("elevenlabsKey", {
      type: "string",
      description: "ElevenLabs API key",
      demandOption: true,
    })
    .option("cacheDir", {
      type: "string",
      default: path.join(os.homedir(), ".welltale", "cache"),
      description: "Directory for caching generated content",
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  const cartridgeDirs = [
    process.cwd(),
    path.join(__dirname, "..", "test", "fixtures"),
    path.join(os.homedir(), ".welltale", "cartridges"),
  ];

  const openai = new OpenAI({ apiKey: argv.openaiKey });
  const elevenlabs = new ElevenLabsClient({ apiKey: argv.elevenlabsKey });
  const cache = new LocalCache(argv.cacheDir);

  const serviceProvider = new LocalServiceProvider(
    {
      openai,
      eleven: elevenlabs,
      cache,
    },
    cartridgeDirs
  );

  const app = express();
  app.use(express.json());

  app.post("/advance", async (req, res) => {
    try {
      const parsed = RequestSchema.parse(req.body);
      const { storyId, session, options } = parsed;
      const cartridge = await serviceProvider.loadCartridge(storyId);
      const root = compileStory(cartridge);
      const result = await advanceStory(
        serviceProvider,
        root,
        session,
        options
      );
      res.json(result);
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(400).json({
        error,
      });
    }
  });

  app.listen(argv.port, () => {
    console.log(`Welltale server running on port ${argv.port}`);
    console.log("Cartridge directories:");
    cartridgeDirs.forEach((dir) => console.log(`  - ${dir}`));
  });
}

main().catch(console.error);
