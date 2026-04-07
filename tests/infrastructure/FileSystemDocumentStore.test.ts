import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { FileSystemDocumentStore } from "../../src/infrastructure/filesystem/FileSystemDocumentStore";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cforge-test-"));
}

describe("FileSystemDocumentStore", () => {
  let root: string;
  let store: FileSystemDocumentStore;

  beforeEach(() => {
    root = tmpDir();
    store = new FileSystemDocumentStore(root);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // exists
  // -------------------------------------------------------------------------

  it("returns false for a file that does not exist", () => {
    expect(store.exists("missing.md")).toBe(false);
  });

  it("returns true for a file that was written", () => {
    store.write("present.md", "hello");
    expect(store.exists("present.md")).toBe(true);
  });

  it("returns true for a directory that was created with ensureDir", () => {
    store.ensureDir("docs/decisions");
    expect(store.exists("docs/decisions")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // read / write
  // -------------------------------------------------------------------------

  it("reads back the content written to a file", () => {
    store.write("README.md", "# Hello");
    expect(store.read("README.md")).toBe("# Hello");
  });

  it("creates parent directories when writing a nested file", () => {
    store.write("docs/decisions/0001.md", "# ADR");
    expect(store.exists("docs/decisions/0001.md")).toBe(true);
  });

  it("overwrites an existing file on second write", () => {
    store.write("file.md", "first");
    store.write("file.md", "second");
    expect(store.read("file.md")).toBe("second");
  });

  // -------------------------------------------------------------------------
  // ensureDir
  // -------------------------------------------------------------------------

  it("creates a nested directory structure", () => {
    store.ensureDir("a/b/c");
    expect(fs.existsSync(path.join(root, "a/b/c"))).toBe(true);
  });

  it("does not throw when the directory already exists", () => {
    store.ensureDir("existing");
    expect(() => store.ensureDir("existing")).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // glob
  // -------------------------------------------------------------------------

  it("returns an empty array when the base directory does not exist", () => {
    expect(store.glob("docs/**/*.md")).toEqual([]);
  });

  it("returns relative paths for matching files", () => {
    store.write("docs/decisions/0001.md", "adr1");
    store.write("docs/decisions/0002.md", "adr2");
    store.write("docs/scenarios/sc1.md", "sce1");

    const results = store.glob("docs/**/*.md");
    expect(results).toHaveLength(3);
    expect(results).toContain("docs/decisions/0001.md");
    expect(results).toContain("docs/decisions/0002.md");
    expect(results).toContain("docs/scenarios/sc1.md");
  });

  it("does not return files that do not match the extension", () => {
    store.write("docs/decisions/note.txt", "txt");
    store.write("docs/decisions/0001.md", "md");

    const results = store.glob("docs/**/*.md");
    expect(results).toEqual(["docs/decisions/0001.md"]);
  });
});
