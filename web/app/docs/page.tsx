import { ACTION_HANDLERS } from "../../../lib/StoryActions";
import { TEMPLATE_SYNTAX } from "../../../lib/StoryDocs";
import { CodeBlock } from "../../components/CodeBlock";
import DocsClient, { HandlerEntry } from "./DocsClient";
import styles from "./docs.module.css";

const QUICKSTART_CODE = `<p>Welcome to your adventure!</p>
<input name.description="your character's name" />
<p>Hello {{name}}, ready to begin?</p>

<if cond="name === 'Alex'">
  <p>Oh, you're that famous Alex I've heard about!</p>
</if>

<music duration="10000">Epic orchestral music for the start of an adventure</music>
<p>Your journey starts now...</p>`;

function buildHandlerEntries(): HandlerEntry[] {
  return ACTION_HANDLERS.reduce<HandlerEntry[]>((list, handler) => {
    if (!handler.tags.length) return list;
    if (!handler.docs) return list;

    const example = handler.docs.ex[0] ?? null;
    const exampleBlock = example
      ? {
          block: (
            <CodeBlock
              code={example.code}
              language="welltale"
              className={styles.codeBlock}
              theme="github-dark"
            />
          ),
          note: example.note ?? null,
        }
      : null;

    const categories = handler.docs.cats ?? [];

    const options = handler.syntax?.atts
      ? Object.entries(handler.syntax.atts).map(([name, value]) => ({
          name,
          description: value.desc,
          required: value.req ?? false,
        }))
      : [];

    list.push({
      primaryTag: handler.tags[0],
      tags: handler.tags,
      description: handler.docs.desc,
      categories,
      options,
      example: exampleBlock,
    });

    return list;
  }, []);
}

export default function DocsPage() {
  const handlerEntries = buildHandlerEntries();

  return (
    <div className={styles.docsContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>Welltale Story Language Reference</h1>
        <p className={styles.subtitle}>
          Welltale Story Language (WSL) is a syntax for creating interactive
          audio stories. Audio stories are written using a mix of XML-like tags
          and templating patterns. Out of the box, WSL is connected to speech-,
          sound-, and text-generation AI tools, making new kinds of interactive,
          audio-based storytelling possible.
        </p>
      </header>

      <section className={styles.quickstart}>
        <h2 className={styles.sectionTitle}>Quick Start</h2>
        <p className={styles.quickstartText}>
          WSL is based on XML, where you use tags to determine the structure and
          flow of your story. Each tag does something different - some play
          speech clips, others get input from users, and some use AI to make
          your story dynamic and interactive.
        </p>

        <div className={styles.quickstartExample}>
          <h3>Your First Story:</h3>
          <CodeBlock
            code={QUICKSTART_CODE}
            language="welltale"
            className={styles.codeBlock}
            theme="github-dark"
          />
          <p className={styles.exampleNote}>
            The above example creates an interactive story that greets the
            player, gets their name, and responds differently if they're named
            Alex. Note the use of template syntax to easily interpolate state
            variables. This is only the beginning, however; many more powerful
            features are available.
          </p>
          <p className={styles.exampleNote}>
            The full list of available XML tags is below, but first let's look
            into the templating patterns available.
          </p>
        </div>
      </section>

      <section className={styles.templateSyntax}>
        <h2 className={styles.sectionTitle}>Template Pattern Syntax</h2>
        <p className={styles.sectionDescription}>
          WSL provides four templating patterns that make your stories dynamic
          and interactive: variable interpolation for inserting values,
          JavaScript expressions for calculations, text variations for
          randomness, and AI prompts for generated content. These patterns can
          be combined and, in such cases, are processed in the following order:
          variables, expressions, variations, text generation.
        </p>

        <div className={styles.syntaxList}>
          {TEMPLATE_SYNTAX.map((syntax, index) => (
            <div key={index} className={styles.syntaxCard}>
              <h3 className={styles.syntaxName}>{syntax.syntax}</h3>
              <p className={styles.syntaxDescription}>{syntax.description}</p>
              {syntax.examples.map((example, exampleIndex) => (
                <div key={exampleIndex} className={styles.syntaxExample}>
                  <CodeBlock
                    code={example.code}
                    language="welltale"
                    className={styles.codeBlock}
                    theme="github-dark"
                  />
                  {example.note && (
                    <p className={styles.exampleNote}>{example.note}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <DocsClient handlers={handlerEntries} />
    </div>
  );
}
