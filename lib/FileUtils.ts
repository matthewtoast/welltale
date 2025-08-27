import * as fs from "fs/promises";
import * as path from "path";

export async function loadDirRecursive(
  dir: string
): Promise<Record<string, Buffer>> {
  const result: Record<string, Buffer> = {};

  async function walk(currentPath: string, basePath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, basePath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(basePath, fullPath);
        result[relativePath] = await fs.readFile(fullPath);
      }
    }
  }

  await walk(dir, dir);
  return result;
}
