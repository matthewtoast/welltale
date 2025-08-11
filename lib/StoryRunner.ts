import { TSerial } from "typings";
import { PRNG } from "./RandHelpers";

export interface BeatChunk {
  type: string;
  time: number; // Unix time current beat was created
  from: string; // Who produced the chunk (used for dialog)
  to: string[]; // Who this was directed to
  obs: string[]; // Observers of this chunk
  body: string;
  url: string | null;
  meta: Record<string, TSerial>;
}

export interface StoryBeat {
  id: string;
  parent: string | null; // Identifier of parent beat (to resume and try new branches)
  type: "in" | "out"; // Input or output beat
  time: number; // Unix time current beat was created
  chunk: BeatChunk[];
}

export type Cartridge = Record<string, Buffer | string>;

export interface Playthru {
  id: string;
  engine: string; // Name of preferred playback engine (e.g. Ink)
  time: number; // Real-world Unix time of current game step
  turn: number; // Current turn i.e. game step
  seed: string; // Seed value for PRNG
  cycle: number; // Cycle value for PRNG (to resume at previous point)
  state: Record<string, TSerial>; // Generic container for any game state
  genie: Cartridge; // Like Game Genie we can monkeypatch the cartridge
  beats: StoryBeat[]; // Full or truncated history of story beats
}

export interface Story {
  id: string;
  cartridge: Cartridge;
}

export abstract class PlaybackAdapter {
  abstract step(
    rng: PRNG,
    story: Story,
    state: Playthru,
    input: string
  ): Promise<void>;
}

export async function step(
  story: Story,
  state: Playthru,
  input: string,
  adapter: PlaybackAdapter
) {
  const rng = new PRNG(state.seed, state.cycle);
  state.time = Date.now();
  state.turn++;
  await adapter.step(
    rng,
    { ...story, cartridge: { ...story.cartridge, ...state.genie } }, // State can override cartridge content
    state,
    input
  );
  state.cycle = rng.cycle;
  return state;
}
