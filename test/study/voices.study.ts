import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadSstEnv } from "../../env/env-sst";
import { searchVoices } from "../../lib/ElevenLabsUtils";

const env = loadSstEnv();

async function testVoiceSearch() {
  const argv = yargs(hideBin(process.argv)).argv as { _: string[] };
  const searchQuery = argv._[0];

  if (!searchQuery) {
    console.warn("No search query provided");
    return null;
  }

  console.log(searchQuery);

  const apiKey = env.ELEVENLABS_API_KEY;
  const client = new ElevenLabsClient({ apiKey });

  const results = await searchVoices({
    client,
    search: searchQuery,
    voiceType: "community",
    category: "generated",
    pageSize: 10,
    sortDirection: "desc",
  });

  results.voices.forEach((voice, index) => {
    const terms = [
      voice.voiceId,
      voice.name,
      voice.description ?? "",
      Object.values(voice.labels ?? {}),
    ];
    console.log(...terms);
  });
}

testVoiceSearch();
