/**
 * Abstraction over filesystem operations, scoped to a project root.
 * Paths are relative to the project root passed to the concrete implementation.
 */
export interface DocumentStore {
  /** Returns true if the path exists (file or directory). */
  exists(relativePath: string): boolean;

  /** Reads a file and returns its content as a UTF-8 string. */
  read(relativePath: string): string;

  /** Writes content to a file, creating parent directories as needed. */
  write(relativePath: string, content: string): void;

  /** Creates a directory (and any missing parents) if it does not exist. */
  ensureDir(relativePath: string): void;

  /** Returns matching relative paths for a glob pattern rooted at the project root. */
  glob(pattern: string): string[];
}
