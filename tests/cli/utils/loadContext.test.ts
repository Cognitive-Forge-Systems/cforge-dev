import { loadContext } from "../../../src/cli/utils/loadContext";

jest.mock("fs");
import * as fs from "fs";
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;

jest.mock("../../../src/cli/utils/resolveRepo");
import { resolveRepoFromGit } from "../../../src/cli/utils/resolveRepo";
const mockResolveRepoFromGit = resolveRepoFromGit as jest.MockedFunction<typeof resolveRepoFromGit>;

const CFORGE_DEV_CONTENT = `# CFORGE_DEV.md

## Identity
- **Repo:** test-owner/test-repo
- **Stack:** Node.js

## Architecture Rules
- TDD-first
- Domain never imports from Infrastructure

## Existing Modules
- MyModule: does stuff
- OtherModule: does other stuff

## Open Questions
- Why does this exist?
`;

describe("loadContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveRepoFromGit.mockReturnValue({ owner: "git-owner", repo: "git-repo" });
    mockReaddirSync.mockReturnValue([]);
  });

  describe("with CFORGE_DEV.md present", () => {
    beforeEach(() => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("CFORGE_DEV.md"));
      mockReadFileSync.mockReturnValue(CFORGE_DEV_CONTENT as any);
    });

    it("loads repo owner and name from CFORGE_DEV.md", () => {
      const ctx = loadContext();
      expect(ctx.repoOwner).toBe("test-owner");
      expect(ctx.repoName).toBe("test-repo");
    });

    it("loads stack from CFORGE_DEV.md", () => {
      const ctx = loadContext();
      expect(ctx.stack).toBe("Node.js");
    });

    it("loads architecture rules from CFORGE_DEV.md", () => {
      const ctx = loadContext();
      expect(ctx.rules).toContain("TDD-first");
      expect(ctx.rules).toContain("Domain never imports from Infrastructure");
    });

    it("loads existing modules from CFORGE_DEV.md", () => {
      const ctx = loadContext();
      expect(ctx.existingModules).toContainEqual({ name: "MyModule", description: "does stuff" });
    });

    it("loads open questions from CFORGE_DEV.md", () => {
      const ctx = loadContext();
      expect(ctx.openQuestions).toContain("Why does this exist?");
    });
  });

  describe("without CFORGE_DEV.md — standard context files", () => {
    beforeEach(() => {
      mockReadFileSync.mockReturnValue("# Project\n" as any);
    });

    it("does not throw when README.md exists", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("README.md"));
      expect(() => loadContext()).not.toThrow();
    });

    it("does not throw when IDEA.md exists", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("IDEA.md"));
      expect(() => loadContext()).not.toThrow();
    });

    it("does not throw when ARCHITECTURE.md exists", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("ARCHITECTURE.md"));
      expect(() => loadContext()).not.toThrow();
    });

    it("does not throw when MEMORANDUM.md exists", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("MEMORANDUM.md"));
      expect(() => loadContext()).not.toThrow();
    });

    it("does not throw when MILESTONES.md exists", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("MILESTONES.md"));
      expect(() => loadContext()).not.toThrow();
    });

    it("does not throw when CONTRIBUTING.md exists", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("CONTRIBUTING.md"));
      expect(() => loadContext()).not.toThrow();
    });

    it("resolves repo owner and name from git when using standard files", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("README.md"));
      const ctx = loadContext();
      expect(ctx.repoOwner).toBe("git-owner");
      expect(ctx.repoName).toBe("git-repo");
    });

    it("falls back to 'unknown' for repo when git also fails", () => {
      mockResolveRepoFromGit.mockReturnValue(undefined);
      mockExistsSync.mockImplementation((p) => String(p).endsWith("README.md"));
      const ctx = loadContext();
      expect(ctx.repoOwner).toBe("unknown");
      expect(ctx.repoName).toBe("unknown");
    });

    it("defaults stack to TypeScript when not in standard files", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("README.md"));
      const ctx = loadContext();
      expect(ctx.stack).toBe("TypeScript");
    });

    it("defaults architecture to Clean Architecture when not in standard files", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("README.md"));
      const ctx = loadContext();
      expect(ctx.architecture).toBe("Clean Architecture");
    });

    it("returns empty rules and modules when standard files have no structured sections", () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith("README.md"));
      const ctx = loadContext();
      expect(ctx.rules).toEqual([]);
      expect(ctx.existingModules).toEqual([]);
      expect(ctx.openQuestions).toEqual([]);
    });
  });

  describe("without CFORGE_DEV.md — docs/**/*.md files", () => {
    it("does not throw when a docs markdown file exists", () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s.endsWith("/docs") || s.endsWith("\\docs");
      });
      mockReaddirSync.mockReturnValue([
        { name: "api.md", isDirectory: () => false, isFile: () => true },
      ] as any);
      mockReadFileSync.mockReturnValue("# API Docs\n" as any);
      expect(() => loadContext()).not.toThrow();
    });

    it("recursively finds markdown files in nested docs subdirectories", () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s.endsWith("/docs") || s.endsWith("\\docs") || s.includes("/docs/");
      });
      mockReaddirSync.mockImplementation((dir) => {
        const s = String(dir);
        if (s.endsWith("/docs") || s.endsWith("\\docs")) {
          return [{ name: "sub", isDirectory: () => true, isFile: () => false }] as any;
        }
        return [{ name: "guide.md", isDirectory: () => false, isFile: () => true }] as any;
      });
      mockReadFileSync.mockReturnValue("# Guide\n" as any);
      expect(() => loadContext()).not.toThrow();
    });
  });

  describe("when no context files exist", () => {
    it("throws when CFORGE_DEV.md and all standard files are absent", () => {
      mockExistsSync.mockReturnValue(false);
      expect(() => loadContext()).toThrow(
        "CFORGE_DEV.md not found — run cforge-dev from project root"
      );
    });

    it("throws the exact legacy error message", () => {
      mockExistsSync.mockReturnValue(false);
      expect(() => loadContext()).toThrowError(
        "CFORGE_DEV.md not found — run cforge-dev from project root"
      );
    });
  });
});
