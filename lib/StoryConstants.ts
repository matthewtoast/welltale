import { StorySession } from "./StoryTypes";

export const HOST_ID = "HOST";
export const PLAYER_ID = "USER";

export function assignInput(session: StorySession, input: string | null) {
  if (input !== null) {
    if (!session.input) {
      session.input = { atts: {}, body: input, from: PLAYER_ID };
    } else {
      session.input.body = input;
    }
  }
}
