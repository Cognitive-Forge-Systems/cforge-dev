import * as fs from "fs";
import * as path from "path";
import { DocumentStore } from "../../domain/interfaces/DocumentStore";

/**
 * Filesystem-backed DocumentStore.
 * All relative paths are resolved against `root` (defaults to `process.cwd()`).
 */
export class FileSystemDocumentStore implements DocumentStore {
  private readonly root: string;

  constructor(root: string = process.cwd()) {
    this.root = root;
  }

  exists(relativePath: string): boolean {
    return fs.existsSync(this.abs(relativePath));
  }

  read(relativePath: string): string {
    return fs.readFileSync(this.abs(relativePath), "utf-8");
  }

  write(relativePath: string, content: string): void {
    const absPath = this.abs(relativePath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, "utf-8");
  }

  ensureDir(relativePath: string): void {
    fs.mkdirSync(this.abs(relativePath), { recursive: true });
  }

  glob(pattern: string): string[] {
    // Simple recursive glob that avoids adding a new dependency.
    // Supports patterns of the form "docs/**/*.md".
    const [base, ...rest] = pattern.split("/**");
    const baseDir = this.abs(base);

    if (!fs.existsSync(baseDir)) return [];

    // Extract the file suffix after the last `*` in the glob tail (e.g. "/*.md" → ".md")
    const ext = rest[0]?.replace(/^.*\*/, "") ?? "";
    const results: string[] = [];
    this.walk(baseDir, ext, results);

    return results.map((abs) => path.relative(this.root, abs).replace(/\\/g, "/"));
  }

  private walk(dir: string, ext: string, results: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walk(full, ext, results);
      } else if (!ext || entry.name.endsWith(ext)) {
        results.push(full);
      }
    }
  }

  private abs(relativePath: string): string {
    return path.join(this.root, relativePath);
  }
}
