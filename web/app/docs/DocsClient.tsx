"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActionHandlerCategory } from "../../../lib/StoryTypes";
import styles from "./docs.module.css";

interface HandlerOption {
  name: string;
  description: string;
  required: boolean;
}

interface HandlerExample {
  block: ReactNode;
  note: string | null;
}

export interface HandlerEntry {
  primaryTag: string;
  tags: string[];
  description: string;
  categories: ActionHandlerCategory[];
  options: HandlerOption[];
  example: HandlerExample | null;
}

interface DocsClientProps {
  handlers: HandlerEntry[];
}

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

type CategoryFilter = ActionHandlerCategory | "all";

function collectCategories(handlers: HandlerEntry[]): ActionHandlerCategory[] {
  const set = new Set<ActionHandlerCategory>();
  handlers.forEach((handler) => {
    handler.categories.forEach((category) => {
      set.add(category);
    });
  });
  return Array.from(set).sort();
}

function filterHandlers(
  handlers: HandlerEntry[],
  category: CategoryFilter,
  search: string
): HandlerEntry[] {
  const term = search.trim().toLowerCase();
  return handlers.filter((handler) => {
    if (!handler.tags.length) return false;
    if (category !== "all" && !handler.categories.includes(category)) return false;
    if (!term) return true;
    const tagMatch = handler.tags.some((tag) => tag.toLowerCase().includes(term));
    if (tagMatch) return true;
    return handler.description.toLowerCase().includes(term);
  });
}

export default function DocsClient({ handlers }: DocsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const categories = useMemo(
    () => collectCategories(handlers),
    [handlers]
  );

  const filteredHandlers = useMemo(
    () => filterHandlers(handlers, selectedCategory, searchTerm),
    [handlers, selectedCategory, searchTerm]
  );

  return (
    <section className={styles.tagReference}>
      <h2 className={styles.sectionTitle}>Tag Reference</h2>
      <p className={styles.sectionDescription}>
        Below, you'll find a list of all tags that can be used when authoring
        stories.
      </p>

      <div className={styles.filters}>
        <select
          value={selectedCategory}
          className={styles.categorySelect}
          onChange={(event) =>
            setSelectedCategory(event.target.value as CategoryFilter)
          }
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_NAMES[category]}
            </option>
          ))}
        </select>

        <div className={styles.categoryInfo}>
          {selectedCategory === "all" ? (
            <p>Select a category to learn what each group covers.</p>
          ) : (
            <div>
              <h3>{CATEGORY_NAMES[selectedCategory]}</h3>
              <p>{CATEGORY_DESCRIPTIONS[selectedCategory]}</p>
            </div>
          )}
        </div>

        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search tags"
          className={styles.searchInput}
        />
      </div>

      <div className={styles.tagList}>
        {filteredHandlers.map((handler) => (
          <div key={handler.primaryTag} className={styles.tagCard}>
            <div className={styles.tagHeader}>
              <h3 className={styles.tagName}>&lt;{handler.primaryTag}&gt;</h3>
              <p className={styles.tagDescription}>
                {handler.description.split("\n")[0]}
              </p>
            </div>

            <div className={styles.tagDetails}>
              {handler.example && (
                <div className={styles.example}>
                  <h4>Example:</h4>
                  {handler.example.block}
                  {handler.example.note && (
                    <p className={styles.exampleNote}>{handler.example.note}</p>
                  )}
                </div>
              )}

              {handler.options.length > 0 && (
                <div className={styles.attributes}>
                  <h4>Options:</h4>
                  <ul className={styles.attrList}>
                    {handler.options.map((option) => (
                      <li key={option.name} className={styles.attrItem}>
                        <span className={styles.attrName}>{option.name}</span>
                        {option.required && (
                          <span className={styles.required}> (required)</span>
                        )}
                        <span className={styles.attrDesc}>
                          : {option.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

