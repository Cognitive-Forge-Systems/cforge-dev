jest.mock("readline");
jest.mock("../../../src/infrastructure/filesystem/FileSystemDocumentStore");
jest.mock("../../../src/cli/utils/resolveRepo");

import * as readline from "readline";
import { initCommand } from "../../../src/cli/commands/init";
import { FileSystemDocumentStore } from "../../../src/infrastructure/filesystem/FileSystemDocumentStore";
import { resolveRepoFromGit } from "../../../src/cli/utils/resolveRepo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockResolveRepoFromGit = resolveRepoFromGit as jest.MockedFunction<typeof resolveRepoFromGit>;
const MockFileSystemDocumentStore = FileSystemDocumentStore as jest.MockedClass<typeof FileSystemDocumentStore>;
const mockCreateInterface = readline.createInterface as jest.MockedFunction<typeof readline.createInterface>;

/** Simulate readline where every question is answered with `answer`. */
function mockReadline(answer = "N") {
  mockCreateInterface.mockReturnValue({
    question: (_q: string, cb: (a: string) => void) => cb(answer),
    close: jest.fn(),
  } as any);
}

/** Build a mock store instance. */
function setupMockStore(existingFiles: string[] = []) {
  const instance = {
    exists: jest.fn((p: string) => existingFiles.includes(p)),
    read: jest.fn(() => ""),
    write: jest.fn(),
    ensureDir: jest.fn(),
    glob: jest.fn(() => []),
  };
  MockFileSystemDocumentStore.mockImplementation(() => instance as any);
  return instance;
}

// ---------------------------------------------------------------------------
// Shared setup / teardown
// ---------------------------------------------------------------------------

let mockExit: jest.SpyInstance;
let mockLog: jest.SpyInstance;
let mockError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockExit = jest.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${code}`);
  }) as never);
  mockLog = jest.spyOn(console, "log").mockImplementation(() => {});
  mockError = jest.spyOn(console, "error").mockImplementation(() => {});
  mockResolveRepoFromGit.mockReturnValue(undefined);
});

afterEach(() => {
  mockExit.mockRestore();
  mockLog.mockRestore();
  mockError.mockRestore();
});

// ---------------------------------------------------------------------------
// --help flag
// ---------------------------------------------------------------------------

describe("initCommand --help", () => {
  it("prints usage and exits 0", async () => {
    setupMockStore();
    await expect(initCommand("--help")).rejects.toThrow("process.exit:0");
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("logs a usage message containing 'init'", async () => {
    setupMockStore();
    await expect(initCommand("--help")).rejects.toThrow("process.exit:0");
    const output = mockLog.mock.calls.map((c: unknown[]) => String(c[0])).join("");
    expect(output).toContain("init");
  });
});

// ---------------------------------------------------------------------------
// IDEA.md already exists — no idea prompts, answers "N" to docs scaffolding
// ---------------------------------------------------------------------------

describe("initCommand — IDEA.md already exists", () => {
  it("runs without error when all standard files already exist", async () => {
    setupMockStore(["IDEA.md", "README.md", "ARCHITECTURE.md", "CFORGE_DEV.md"]);
    mockReadline("N");

    await expect(initCommand()).resolves.toBeUndefined();
  });

  it("does not call store.write when all standard files already exist", async () => {
    const store = setupMockStore(["IDEA.md", "README.md", "ARCHITECTURE.md", "CFORGE_DEV.md"]);
    mockReadline("N");

    await initCommand();

    expect(store.write).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Repo coordinates are resolved from git and forwarded
// ---------------------------------------------------------------------------

describe("initCommand — repo coordinate resolution", () => {
  it("completes successfully when git coords are available", async () => {
    setupMockStore(["IDEA.md", "README.md", "ARCHITECTURE.md", "CFORGE_DEV.md"]);
    mockResolveRepoFromGit.mockReturnValue({ owner: "acme", repo: "my-app" });
    mockReadline("N");

    await expect(initCommand()).resolves.toBeUndefined();
  });

  it("completes successfully when git coords are unavailable", async () => {
    setupMockStore(["IDEA.md", "README.md", "ARCHITECTURE.md", "CFORGE_DEV.md"]);
    mockResolveRepoFromGit.mockReturnValue(undefined);
    mockReadline("N");

    await expect(initCommand()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// docs scaffolding triggered by "y" answer
// ---------------------------------------------------------------------------

describe("initCommand — docs scaffolding", () => {
  it("calls store.ensureDir for docs/decisions and docs/scenarios when user answers y", async () => {
    const store = setupMockStore(["IDEA.md", "README.md", "ARCHITECTURE.md", "CFORGE_DEV.md"]);
    mockReadline("y");

    await initCommand();

    expect(store.ensureDir).toHaveBeenCalledWith("docs/decisions");
    expect(store.ensureDir).toHaveBeenCalledWith("docs/scenarios");
  });
});
