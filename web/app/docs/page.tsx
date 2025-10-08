"use client";

import { useMemo, useState } from "react";
import { ACTION_HANDLERS } from "../../../lib/StoryActions";
import { TEMPLATE_SYNTAX } from "../../../lib/StoryDocs";
import { ActionHandlerCategory } from "../../../lib/StoryTypes";
import { CodeBlock } from "../../components/CodeBlock";
import styles from "./docs.module.css";

const CATEGORY_NAMES: Record<ActionHandlerCategory, string> = {
  control_flow: "Control Flow",
  ai: "AI & Smart Features",
  render: "Text & Narration",
  descendable: "Structure & Layout",
  media: "Sound & Music",
  dev: "Variables & Logic",
  http: "External Data",
  compile_time: "Advanced Features",
  state: "Data Storage",
};

const CATEGORY_DESCRIPTIONS: Record<ActionHandlerCategory, string> = {
  control_flow: "Control how your story flows and branches",
  ai: "Use AI to make your story interactive and dynamic",
  render: "Display text and dialogue to your audience",
  descendable: "Organize your story into sections",
  media: "Add sound effects and background music",
  dev: "Store information and make decisions",
  http: "Load data from the internet",
  compile_time: "Special features for advanced users",
  state: "Save and manage story information",
};

function TagCard({ handler }: { handler: (typeof ACTION_HANDLERS)[0] }) {
  const primaryTag = handler.tags[0];

  if (!primaryTag || !handler.docs) return null;

  return (
    <div className={styles.tagCard}>
      <div className={styles.tagHeader}>
        <h3 className={styles.tagName}>&lt;{primaryTag}&gt;</h3>
        <p className={styles.tagDescription}>
          {handler.docs.desc.split("\n")[0]}
        </p>
      </div>

      <div className={styles.tagDetails}>
        {handler.docs.ex?.[0] && (
          <div className={styles.example}>
            <h4>Example:</h4>
            <CodeBlock
              code={handler.docs.ex[0].code}
              className={styles.codeBlock}
            />
            {handler.docs.ex[0].note && (
              <p className={styles.exampleNote}>{handler.docs.ex[0].note}</p>
            )}
          </div>
        )}

        {handler.syntax?.atts &&
          Object.keys(handler.syntax.atts).length > 0 && (
            <div className={styles.attributes}>
              <h4>Options:</h4>
              <ul className={styles.attrList}>
                {Object.entries(handler.syntax.atts).map(([name, attr]) => (
                  <li key={name} className={styles.attrItem}>
                    <span className={styles.attrName}>{name}</span>
                    {attr.req && (
                      <span className={styles.required}> (required)</span>
                    )}
                    <span className={styles.attrDesc}>: {attr.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </div>
  );
}

export default function DocsPage() {
  const [selectedCategory, setSelectedCategory] = useState<
    ActionHandlerCategory | "all"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredHandlers = useMemo(() => {
    return ACTION_HANDLERS.filter((handler) => {
      if (!handler.tags.length || !handler.docs) return false;

      const matchesCategory =
        selectedCategory === "all" ||
        handler.docs.cats?.includes(selectedCategory);

      const matchesSearch =
        !searchTerm ||
        handler.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        handler.docs.desc.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchTerm]);

  const categories = useMemo(() => {
    const cats = new Set<ActionHandlerCategory>();
    ACTION_HANDLERS.forEach((h) => {
      h.docs?.cats?.forEach((cat) => cats.add(cat));
    });
    return Array.from(cats).sort();
  }, []);

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
            code={`<p>Welcome to your adventure!</p>
<input name.description="your character's name" />
<p>Hello {{name}}, ready to begin?</p>

<if cond="name === 'Alex'">
  <p>Oh, you're that famous Alex I've heard about!</p>
</if>

<music duration="10000">Epic orchestral music for the start of an adventure</music>
<p>Your journey starts now...</p>`}
            className={styles.codeBlock}
          />
          <p className={styles.exampleNote}>
            The above example creates an interactive story that greets the
            player, gets their name, and responds differently if they're named
            Alex. Note the use of template syntax to easily interpolate state
            variables. This is only the beginning, however; many more powerful
            features are available.
          </p>
          <p className={styles.exampleNote}>
            The full list of available XMl tags is below, but first let's look
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
          {TEMPLATE_SYNTAX.map((syntax, idx) => (
            <div key={idx} className={styles.syntaxCard}>
              <h3 className={styles.syntaxName}>{syntax.syntax}</h3>
              <p className={styles.syntaxDescription}>{syntax.description}</p>
              {syntax.examples.map((example, exIdx) => (
                <div key={exIdx} className={styles.syntaxExample}>
                  <CodeBlock code={example.code} className={styles.codeBlock} />
                  {example.note && (
                    <p className={styles.exampleNote}>{example.note}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.tagReference}>
        <h2 className={styles.sectionTitle}>Tag Reference</h2>
        <p className={styles.sectionDescription}>
          Below, you'll find a list of all tags that can be used when authoring
          your story. Whether you want to control story flow, generate text from
          an LLM, use an LLM to classify the user's input, generate a sound
          clip, or just about anything an interactive audio story might need, a
          tag is available for you.
        </p>

        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />

          <div className={styles.categoryFilter}>
            <button
              className={`${styles.categoryButton} ${selectedCategory === "all" ? styles.active : ""}`}
              onClick={() => setSelectedCategory("all")}
            >
              All Features
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`${styles.categoryButton} ${selectedCategory === cat ? styles.active : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {CATEGORY_NAMES[cat]}
              </button>
            ))}
          </div>
        </div>

        {selectedCategory !== "all" && (
          <p className={styles.categoryDescription}>
            {CATEGORY_DESCRIPTIONS[selectedCategory]}
          </p>
        )}

        <div className={styles.tagList}>
          {filteredHandlers.length === 0 ? (
            <p className={styles.noResults}>
              No tags found matching your search.
            </p>
          ) : (
            filteredHandlers.map((handler, idx) => (
              <TagCard key={idx} handler={handler} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
