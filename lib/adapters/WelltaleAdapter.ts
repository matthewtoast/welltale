import { evalExpr, Primitive } from "lib/EvalUtils";
import { parseNumberOrNull } from "lib/MathHelpers";
import {
  findNode,
  Node,
  parseMarkdownToSection,
  Section,
} from "lib/ParseHelpers";
import { PRNG } from "lib/RandHelpers";
import {
  Cartridge,
  Op,
  PlaybackAdapter,
  Playthru,
  Story,
} from "lib/StoryRunner";
import { isBlank, renderHandlebars } from "lib/TextHelpers";

export interface WelltaleState extends Record<string, Primitive | Primitive[]> {
  section: string;
  cursor: string;
  input: string;
  __inputVarName: string;
  __lastEvalVarName: string;
}

export class WelltaleAdapter extends PlaybackAdapter {
  async step(
    rng: PRNG,
    story: Story,
    playthru: Playthru<WelltaleState>,
    input: string,
    ops: Op[] = []
  ) {
    const sections = await this.compile(story.cartridge);
    const { state } = playthru;

    state.input = input;
    state[state.__inputVarName] = input;

    let section = sections.find((s) => s.path === state.section);

    let node: Node | null = section
      ? findNode(section.root, (n) => n.id === state.cursor)
      : null;

    while (node && section) {
      const { tag, atts, kids, text } = node;

      // Create renderedAtts by applying handlebars and evalExpr to all attribute values
      const ratts: Record<string, string> = {};
      for (const [key, value] of Object.entries(atts)) {
        try {
          ratts[key] = renderHandlebars(value, state, rng);
        } catch {
          ratts[key] = value;
        }
      }

      // Create renderedText by applying handlebars rendering
      let rtext = "";
      if (typeof text === "string" && !isBlank(text)) {
        try {
          rtext = renderHandlebars(text, state, rng);
        } catch {
          rtext = text;
        }
      }

      function nextNode(
        curr: Node,
        useKids: boolean
      ): { node: Node; section: Section } | null {
        // TODO: Given the current node, determine the next node
        // to go to. By definition, this is the next sibling in sequence.
        // If we are the last sibling, then its the next sibling of our *parent*
        return null;
      }

      function searchNode(
        flex: string | null | undefined
      ): { node: Node; section: Section } | null {
        if (!flex || isBlank(flex)) {
          return null;
        }
        // TODO: The input 'flex' var may be
        // a reference to a heading name like "the big game"
        // a parameterized/slugified version of the same "the-big-game"
        // a node identifier "0.0.12"
        // a node identifier scoped to a section "blah.md.0.0.12"
        // In any case, find the appropriate node
        // Start in the current section; if not found, check others
        // This should search the whole tree of every section
        return null;
      }

      function assignNode(result: ReturnType<typeof nextNode>) {
        node = result?.node ?? null;
        state.cursor = result?.node.id ?? "0";
        state.section = result?.section.path ?? "main.md";
      }

      switch (tag) {
        case "input":
          ops.push({
            type: "input",
            limit: parseNumberOrNull(ratts.limit ?? ratts.for),
            key: ratts.to ?? ratts.key ?? "input",
          });
          assignNode(nextNode(node, false));
          node = null; // Must break loop to resolve dependency first
          break;

        case "llm":
          ops.push({
            type: "llm-request",
            prompt: (ratts.prompt ?? "") + rtext,
            schema: ratts.schema ?? ratts.as ?? ratts.to,
          });
          assignNode(nextNode(node, false));
          node = null; // Must break loop to resolve dependency first
          break;

        case "sound":
          if (ratts.url) {
            ops.push({
              type: "play-sound",
              url: ratts.url,
            });
          } else if (ratts.gen) {
            ops.push({
              type: "gen-sound",
              prompt: ratts.gen ?? ratts.prompt,
            });
          }
          assignNode(nextNode(node, false));
          break;

        case "wait":
          ops.push({
            type: "wait",
            duration: parseNumberOrNull(ratts.duration ?? ratts.for) ?? 1,
          });
          // Even though the audience has to wait, we continue to process
          assignNode(nextNode(node, false));
          break;

        case "go":
          if (!ratts.if || evalExpr(ratts.if, state, {}, rng)) {
            assignNode(searchNode(ratts.to));
          } else {
            assignNode(nextNode(node, false));
          }
          break;

        case "if":
          if (kids.length > 0 && evalExpr(ratts.cond, state, {}, rng)) {
            assignNode({ node: kids[0], section });
          } else {
            assignNode(nextNode(node, false));
          }
          break;

        case "set":
          state[ratts.var ?? ratts.to] = evalExpr(ratts.op, state, {}, rng);
          assignNode(nextNode(node, false));
          break;

        case "text":
        case "p":
          if (!isBlank(rtext)) {
            ops.push({
              type: "render-words",
              content: rtext,
              ...ratts,
            });
          }
          assignNode(nextNode(node, false));
          break;

        // We ignore comments, <root>, <h*>, <em>, junk etc
        default:
          assignNode(nextNode(node, false));
          break;
      }
    }
    return ops;
  }

  async compile(cartridge: Cartridge) {
    const sources: Section[] = [];
    for (let path in cartridge) {
      const content = cartridge[path];
      if (path.endsWith(".json")) {
        sources.push(JSON.parse(content.toString("utf-8")));
      } else if (path.endsWith(".md")) {
        const { root, meta } = parseMarkdownToSection(
          content.toString("utf-8")
        );
        sources.push({ root, meta, path });
      }
    }
    return sources;
  }
}
