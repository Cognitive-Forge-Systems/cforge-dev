import { InitProject, CONTEXT_FILE_ORDER } from "../../src/application/use-cases/InitProject";
import { DocumentStore } from "../../src/domain/interfaces/DocumentStore";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

interface MockStore extends DocumentStore {
  _written: Record<string, string>;
  _dirs: string[];
}

function mockStore(existingFiles: Record<string, string> = {}): MockStore {
  const _written: Record<string, string> = {};
  const _dirs: string[] = [];

  return {
    _written,
    _dirs,
    exists: jest.fn((p: string) => p in existingFiles || p in _written),
    read: jest.fn((p: string) => existingFiles[p] ?? _written[p] ?? ""),
    write: jest.fn((p: string, content: string) => { _written[p] = content; }),
    ensureDir: jest.fn((p: string) => { _dirs.push(p); }),
    glob: jest.fn(() => []),
  };
}

// ---------------------------------------------------------------------------
// CONTEXT_FILE_ORDER
// ---------------------------------------------------------------------------

describe("CONTEXT_FILE_ORDER", () => {
  it("includes all required standard files in the specified order", () => {
    expect(CONTEXT_FILE_ORDER).toEqual([
      "README.md",
      "IDEA.md",
      "ARCHITECTURE.md",
      "MEMORANDUM.md",
      "MILESTONES.md",
      "CONTRIBUTING.md",
      "CFORGE_DEV.md",
    ]);
  });
});

// ---------------------------------------------------------------------------
// InitProject — empty project
// ---------------------------------------------------------------------------

describe("InitProject — empty project", () => {
  it("creates CFORGE_DEV.md when it does not exist", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    expect(store._written["CFORGE_DEV.md"]).toBeDefined();
    expect(result.created).toContain("CFORGE_DEV.md");
  });

  it("creates README.md when it does not exist", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    expect(store._written["README.md"]).toBeDefined();
    expect(result.created).toContain("README.md");
  });

  it("creates ARCHITECTURE.md when it does not exist", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    expect(store._written["ARCHITECTURE.md"]).toBeDefined();
    expect(result.created).toContain("ARCHITECTURE.md");
  });

  it("skips IDEA.md when ideaAnswers are not provided", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    expect(store._written["IDEA.md"]).toBeUndefined();
    expect(result.created).not.toContain("IDEA.md");
    expect(result.skipped).toContain("IDEA.md");
  });

  it("creates IDEA.md when ideaAnswers are provided", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    const result = uc.execute({
      scaffoldDocs: false,
      ideaAnswers: {
        problem: "Slow deployments",
        audience: "DevOps engineers",
        differentiator: "AI-native",
      },
    });

    expect(store._written["IDEA.md"]).toBeDefined();
    expect(result.created).toContain("IDEA.md");
  });
});

// ---------------------------------------------------------------------------
// InitProject — existing files are skipped
// ---------------------------------------------------------------------------

describe("InitProject — existing files are skipped", () => {
  it("skips CFORGE_DEV.md when it already exists", () => {
    const store = mockStore({ "CFORGE_DEV.md": "# existing" });
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    expect(store.write).not.toHaveBeenCalledWith("CFORGE_DEV.md", expect.any(String));
    expect(result.skipped).toContain("CFORGE_DEV.md");
    expect(result.created).not.toContain("CFORGE_DEV.md");
  });

  it("skips README.md when it already exists", () => {
    const store = mockStore({ "README.md": "# existing" });
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    expect(store.write).not.toHaveBeenCalledWith("README.md", expect.any(String));
    expect(result.skipped).toContain("README.md");
  });

  it("skips ARCHITECTURE.md when it already exists", () => {
    const store = mockStore({ "ARCHITECTURE.md": "# existing" });
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    expect(store.write).not.toHaveBeenCalledWith("ARCHITECTURE.md", expect.any(String));
    expect(result.skipped).toContain("ARCHITECTURE.md");
  });

  it("skips IDEA.md when it already exists (even with ideaAnswers)", () => {
    const store = mockStore({ "IDEA.md": "# existing" });
    const uc = new InitProject(store);

    const result = uc.execute({
      scaffoldDocs: false,
      ideaAnswers: { problem: "x", audience: "y", differentiator: "z" },
    });

    expect(store.write).not.toHaveBeenCalledWith("IDEA.md", expect.any(String));
    expect(result.skipped).toContain("IDEA.md");
  });
});

// ---------------------------------------------------------------------------
// InitProject — repo coordinates in CFORGE_DEV.md
// ---------------------------------------------------------------------------

describe("InitProject — CFORGE_DEV.md content", () => {
  it("includes owner and repo when coordinates are provided", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    uc.execute({ repoOwner: "acme", repoName: "my-app", scaffoldDocs: false });

    const content = store._written["CFORGE_DEV.md"];
    expect(content).toContain("owner: acme");
    expect(content).toContain("repo: my-app");
  });

  it("uses placeholder when coordinates are not provided", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    uc.execute({ scaffoldDocs: false });

    const content = store._written["CFORGE_DEV.md"];
    expect(content).toContain("<org>");
    expect(content).toContain("<repo-name>");
  });

  it("includes ## Repository and ## Context files sections", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    uc.execute({ scaffoldDocs: false });

    const content = store._written["CFORGE_DEV.md"];
    expect(content).toContain("## Repository");
    expect(content).toContain("## Context files");
  });
});

// ---------------------------------------------------------------------------
// InitProject — IDEA.md content
// ---------------------------------------------------------------------------

describe("InitProject — IDEA.md content", () => {
  it("includes answers in the correct sections", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    uc.execute({
      scaffoldDocs: false,
      ideaAnswers: {
        problem: "Teams ship slow",
        audience: "Startup CTOs",
        differentiator: "Zero-config AI",
      },
    });

    const content = store._written["IDEA.md"];
    expect(content).toContain("Teams ship slow");
    expect(content).toContain("Startup CTOs");
    expect(content).toContain("Zero-config AI");
  });
});

// ---------------------------------------------------------------------------
// InitProject — docs scaffolding
// ---------------------------------------------------------------------------

describe("InitProject — docs scaffolding", () => {
  it("does not scaffold docs/ when scaffoldDocs is false", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    uc.execute({ scaffoldDocs: false });

    expect(store.ensureDir).not.toHaveBeenCalled();
    expect(store._written["docs/decisions/0001-record-architecture-decisions.md"]).toBeUndefined();
  });

  it("creates docs/decisions/ and a template ADR when scaffoldDocs is true", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: true });

    expect(store.ensureDir).toHaveBeenCalledWith("docs/decisions");
    expect(store._written["docs/decisions/0001-record-architecture-decisions.md"]).toBeDefined();
    expect(result.created).toContain("docs/decisions/");
  });

  it("creates docs/scenarios/ and a template SCE when scaffoldDocs is true", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: true });

    expect(store.ensureDir).toHaveBeenCalledWith("docs/scenarios");
    expect(store._written["docs/scenarios/example-scenario.md"]).toBeDefined();
    expect(result.created).toContain("docs/scenarios/");
  });

  it("skips docs/decisions/ if it already exists", () => {
    const store = mockStore({ "docs/decisions": "" });
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: true });

    expect(store.ensureDir).not.toHaveBeenCalledWith("docs/decisions");
    expect(result.created).not.toContain("docs/decisions/");
  });

  it("skips docs/scenarios/ if it already exists", () => {
    const store = mockStore({ "docs/scenarios": "" });
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: true });

    expect(store.ensureDir).not.toHaveBeenCalledWith("docs/scenarios");
    expect(result.created).not.toContain("docs/scenarios/");
  });
});

// ---------------------------------------------------------------------------
// InitProject — context discovery
// ---------------------------------------------------------------------------

describe("InitProject — context discovery", () => {
  it("returns an empty discoveredContextFiles list when no context files exist", () => {
    const store = mockStore();
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    // Files created during execute() do not count as pre-existing context
    expect(result.discoveredContextFiles).toHaveLength(0);
  });

  it("returns existing standard context files in discovery order", () => {
    const store = mockStore({
      "README.md": "# r",
      "ARCHITECTURE.md": "# a",
      "CONTRIBUTING.md": "# c",
    });
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    expect(result.discoveredContextFiles).toEqual(["README.md", "ARCHITECTURE.md", "CONTRIBUTING.md"]);
  });

  it("includes docs/**/*.md files returned by glob in discoveredContextFiles", () => {
    const store: MockStore = {
      ...mockStore(),
      glob: jest.fn(() => ["docs/decisions/0001-foo.md", "docs/scenarios/bar.md"]),
    };
    const uc = new InitProject(store);

    const result = uc.execute({ scaffoldDocs: false });

    expect(result.discoveredContextFiles).toContain("docs/decisions/0001-foo.md");
    expect(result.discoveredContextFiles).toContain("docs/scenarios/bar.md");
  });
});
