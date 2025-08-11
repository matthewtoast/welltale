import { Chapter, parseMarkdownToChapter } from "lib/ParseHelpers";
import { PRNG } from "lib/RandHelpers";
import { Cartridge, PlaybackAdapter, Playthru, Story } from "lib/StoryRunner";

export class WelltaleAdapter extends PlaybackAdapter {
  async step(rng: PRNG, story: Story, state: Playthru, input: string) {
    const chapters = await this.compile(story.cartridge);
  }

  async compile(cartridge: Cartridge) {
    const chapters: Chapter[] = [];
    for (let path in cartridge) {
      const content = cartridge[path];
      if (path.endsWith(".json")) {
        chapters.push(JSON.parse(content.toString("utf-8")));
      } else if (path.endsWith(".md")) {
        chapters.push(parseMarkdownToChapter(content.toString("utf-8")));
      }
    }
    console.log(chapters[0].stanzas[17]);
    return chapters;
  }
}
