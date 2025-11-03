import { MethodDocGroup } from "../../../lib/methods/MethodDocs";
import styles from "./docs.module.css";

interface MethodDocsSectionProps {
  groups: MethodDocGroup[];
}

export function MethodDocsSection({ groups }: MethodDocsSectionProps) {
  return (
    <section className={styles.methodSection}>
      <h2 className={styles.sectionTitle}>Scripting API</h2>
      <p className={styles.sectionDescription}>
        When you use the <code>&lt;script&gt;</code> tag in Welltale, you have
        access to a fully sandboxed JavaScript environment. For convenience, a
        number of built-in utility functions have been provided under the{" "}
        <code>.wsl</code> namespace. These are listed below.
      </p>
      {groups.map((group) => (
        <div key={group.group} className={styles.methodGroup}>
          <h3 className={styles.methodGroupTitle}>{group.group}</h3>
          <ul className={styles.methodList}>
            {group.items.map((item) => (
              <li key={item.name} className={styles.methodItem}>
                <code className={styles.methodExample}>{item.example}</code>
                <p className={styles.methodDescription}>{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
