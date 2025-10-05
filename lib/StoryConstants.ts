import { StorySession } from "./StoryTypes";

export const HOST_ID = "HOST";
export const PLAYER_ID = "USER";

export const TEXT_TAG = "#text";

export const TEXT_CONTENT_TAGS = [
  TEXT_TAG,
  "text",
  "p",
  "span",
  "b",
  "strong",
  "em",
  "i",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

export const DESCENDABLE_TAGS = [
  "root",
  "html",
  "body",
  "div",
  "ul",
  "ol",
  "li",
  "section",
  "sec",
  "pre",
  "scope",
  "origin",
  // Common HTML tags we'll treat as playable content
  "main",
  "aside",
  "article",
  "details",
  "summary",
];

export function assignInput(session: StorySession, input: string | null) {
  if (input !== null) {
    if (!session.input) {
      session.input = { atts: {}, body: input, from: PLAYER_ID };
    } else {
      session.input.body = input;
    }
  }
}
