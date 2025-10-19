import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "fs/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadSstEnv } from "../../env/env-sst";
import { generateSpeechClip } from "../../lib/ElevenLabsUtils";

const env = loadSstEnv();

async function testSpeechGeneration() {
  const argv = yargs(hideBin(process.argv)).argv as { _: string[] };
  const voiceId = argv._[0];

  if (!voiceId) {
    console.warn("No voice ID provided");
    return null;
  }

  const apiKey = env.ELEVENLABS_API_KEY;
  const client = new ElevenLabsClient({ apiKey });

  const text = "Testing speech API.";

  const audioData = await generateSpeechClip({
    client,
    voiceId,
    text,
  });

  const outputPath = `./output_${voiceId}_${Date.now()}.mp3`;
  await fs.writeFile(outputPath, audioData);

  console.log(outputPath);
}

testSpeechGeneration();
