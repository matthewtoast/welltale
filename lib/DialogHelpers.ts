export type Gender = "male" | "female" | "neutral";

const commonMaleNames = new Set([
  "aaron",
  "adam",
  "adrian",
  "alan",
  "albert",
  "alex",
  "alexander",
  "andrew",
  "anthony",
  "antonio",
  "arthur",
  "benjamin",
  "bob",
  "bobby",
  "brandon",
  "brian",
  "bruce",
  "carlos",
  "charles",
  "chris",
  "christopher",
  "daniel",
  "david",
  "dennis",
  "donald",
  "douglas",
  "edward",
  "eric",
  "frank",
  "gary",
  "george",
  "harold",
  "harry",
  "henry",
  "jack",
  "james",
  "jason",
  "jeffrey",
  "jerry",
  "john",
  "jonathan",
  "joseph",
  "joshua",
  "juan",
  "kenneth",
  "kevin",
  "larry",
  "lawrence",
  "mark",
  "matthew",
  "michael",
  "nicholas",
  "noah",
  "patrick",
  "paul",
  "peter",
  "philip",
  "raymond",
  "richard",
  "robert",
  "ronald",
  "ryan",
  "samuel",
  "scott",
  "sean",
  "stephen",
  "steven",
  "thomas",
  "timothy",
  "todd",
  "walter",
  "wayne",
  "william",
  "zachary",
]);

const commonFemaleNames = new Set([
  "amanda",
  "amy",
  "andrea",
  "angela",
  "anna",
  "ashley",
  "barbara",
  "betty",
  "brenda",
  "carol",
  "carolyn",
  "catherine",
  "cheryl",
  "christina",
  "christine",
  "cynthia",
  "deborah",
  "debra",
  "denise",
  "diane",
  "donna",
  "dorothy",
  "elizabeth",
  "emily",
  "emma",
  "evelyn",
  "frances",
  "helen",
  "janet",
  "janice",
  "jean",
  "jennifer",
  "jessica",
  "joan",
  "joyce",
  "judith",
  "judy",
  "julia",
  "julie",
  "karen",
  "kathleen",
  "kathryn",
  "kelly",
  "kimberly",
  "laura",
  "linda",
  "lisa",
  "lori",
  "margaret",
  "maria",
  "marie",
  "marilyn",
  "martha",
  "mary",
  "michelle",
  "nancy",
  "nicole",
  "olivia",
  "pamela",
  "patricia",
  "rachel",
  "rebecca",
  "ruth",
  "sandra",
  "sara",
  "sarah",
  "sharon",
  "shirley",
  "stephanie",
  "susan",
  "teresa",
  "theresa",
  "virginia",
]);

const maleEndings = ["son", "ton", "man", "rick", "ard"];
const femaleEndings = ["a", "ia", "ine", "elle", "ette", "lyn", "leigh", "ko"];

export function inferGenderFromName(name: string): Gender | null {
  const lowerName = name.toLowerCase().trim();
  if (commonMaleNames.has(lowerName)) return "male";
  if (commonFemaleNames.has(lowerName)) return "female";
  for (const ending of maleEndings) {
    if (lowerName.endsWith(ending)) return "male";
  }
  for (const ending of femaleEndings) {
    if (lowerName.endsWith(ending)) return "female";
  }
  return null;
}

export type TaggedLine = ReturnType<typeof parseTaggedSpeakerLine>;

/**
 * Parses a line with optional speaker, tags, recipients, and text.
 * Examples:
 *   "This is the narrator speaking."
 *     -> { speaker: "", tags: [], line: "This is the narrator speaking.", to: [] }
 *   "#female:This is a woman."
 *     -> { speaker: "", tags: ["female"], line: "This is a woman.", to: [] }
 *   "Bob#old,male: This is [sarcastically] a guy speaking."
 *     -> { speaker: "Bob", tags: ["old", "male"], line: "This is [sarcastically] a guy speaking.", to: [] }
 *   "Sarah#SomeVoiceD: I love you."
 *     -> { speaker: "Sarah", tags: ["SomeVoiceD"], line: "I love you.", to: [] }
 *   "Kay#EXAV123: Oh really?"
 *     -> { speaker: "Kay", tags: ["EXAV123"], line: "Oh really?", to: [] }
 *   "Kay#EXAV123 (to Jim, Frank): Oh really?"
 *     -> { speaker: "Kay", tags: ["EXAV123"], line: "Oh really?", to: ["Jim", "Frank"] }
 */
export function parseTaggedSpeakerLine(line: string): {
  speaker: string;
  tags: string[];
  body: string;
  to: string[];
} {
  // Match: [speaker][#tags][ (to recipient1, recipient2)]: text
  // speaker: optional, tags: optional, to: optional, text: required

  // Look for speaker pattern at the start of the line
  // Valid patterns: "Name:", "#tag:", "Name#tag:", "Name (to X):", etc.
  // Name must start with a capital letter and be a single word
  const speakerPattern =
    /^((?:[A-Z][a-zA-Z0-9]*)?(?:#[^:\s]+(?:,[^:\s]+)*)?)\s*(\(to\s+[^)]+\))?\s*:/;
  const match = line.match(speakerPattern);

  // Additional check: ensure we have either a name or tags (not just ":")
  if (match && !match[1]) {
    return { speaker: "", tags: [], body: line.trim(), to: [] };
  }

  if (!match) {
    // No speaker pattern found, treat entire line as content
    return { speaker: "", tags: [], body: line.trim(), to: [] };
  }

  const colonIndex = match.index! + match[0].length - 1;
  const beforeColon = line.substring(0, colonIndex);
  const afterColon = line.substring(colonIndex + 1).trim();

  // Check for "(to ...)" pattern
  let to: string[] = [];
  let beforeColonWithoutTo = beforeColon;

  const toMatch = beforeColon.match(/^(.*?)\s*\(to\s+([^)]+)\)\s*$/);
  if (toMatch) {
    beforeColonWithoutTo = toMatch[1];
    to = toMatch[2]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  }

  // Now parse the part before the colon (and without "to") for speaker and tags
  const speakerTagMatch = beforeColonWithoutTo.match(
    /^(?<speaker>[^#]+)?(?:#(?<tags>.+))?$/
  );

  let speaker = "";
  let tags: string[] = [];

  if (speakerTagMatch && speakerTagMatch.groups) {
    speaker = (speakerTagMatch.groups.speaker || "").trim();
    tags = speakerTagMatch.groups.tags
      ? speakerTagMatch.groups.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  }

  // Add gender tag if not present and can be inferred from speaker
  if (
    !tags.some(
      (tag) => tag === "male" || tag === "female" || tag === "neutral"
    ) &&
    speaker
  ) {
    const inferredGender = inferGenderFromName(speaker);
    if (inferredGender) {
      tags = [...tags, inferredGender];
    }
  }

  return { speaker, tags, body: afterColon, to };
}
