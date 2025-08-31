import { Dirent } from "fs";
import * as fs from "fs/promises";

import * as path from "path";

type ExcludeFunc = (relativePath: string, entry: Dirent<string>) => boolean;

const excludePattern =
  /\.(DS_Store|Thumbs\.db|desktop\.ini|\.git|\.svn|\.hg|node_modules)$/i;

const defaultExclude: ExcludeFunc = (relativePath, entry) =>
  excludePattern.test(relativePath) || excludePattern.test(entry.name);

export async function loadDirRecursive(
  dir: string,
  exclude: ExcludeFunc = defaultExclude
): Promise<Record<string, Buffer>> {
  const result: Record<string, Buffer> = {};

  async function walk(currentPath: string, basePath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (exclude(relativePath, entry)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath, basePath);
      } else if (entry.isFile()) {
        result[relativePath] = await fs.readFile(fullPath);
      }
    }
  }

  await walk(dir, dir);
  return result;
}
