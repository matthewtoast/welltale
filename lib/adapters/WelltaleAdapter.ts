import { StorySource, parseMarkdownToChapter } from "lib/ParseHelpers";
import { PRNG } from "lib/RandHelpers";
import { Cartridge, PlaybackAdapter, Playthru, Story } from "lib/StoryRunner";

export class WelltaleAdapter extends PlaybackAdapter {
  async step(rng: PRNG, story: Story, state: Playthru, input: string) {
    const chapters = await this.compile(story.cartridge);
  }

  async compile(cartridge: Cartridge) {
    const sources: StorySource[] = [];
    for (let path in cartridge) {
      const content = cartridge[path];
      if (path.endsWith(".json")) {
        sources.push(JSON.parse(content.toString("utf-8")));
      } else if (path.endsWith(".md")) {
        sources.push(parseMarkdownToChapter(content.toString("utf-8")));
      }
    }
    return sources;
  }
}
