import { CreateRelease } from "../../src/application/use-cases/CreateRelease";
import { GitHubClient } from "../../src/domain/interfaces/GitHubClient";
import { IssueType, Issue } from "../../src/domain/models/Issue";
import { ProjectContext } from "../../src/domain/models/ProjectContext";

const mockContext: ProjectContext = {
  repoOwner: "test-owner",
  repoName: "test-repo",
  stack: "TypeScript",
  architecture: "Clean Architecture",
  rules: [],
  existingModules: [],
  openQuestions: [],
};

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 1,
    number: 1,
    title: "Test issue",
    body: "Body",
    type: IssueType.FEATURE,
    milestoneId: 1,
    ...overrides,
  };
}

function mockGitHubClient(issues: Issue[]): GitHubClient {
  return {
    createMilestone: jest.fn(),
    createIssue: jest.fn(),
    getIssue: jest.fn(),
    listIssues: jest.fn().mockResolvedValue(issues),
    createBranch: jest.fn(),
    createPullRequest: jest.fn(),
    getPullRequest: jest.fn(),
    listOpenPullRequests: jest.fn(),
    closeIssue: jest.fn(),
    createRelease: jest.fn().mockResolvedValue(undefined),
  };
}

describe("CreateRelease", () => {
  it("should throw if open issues exist — release NOT created", async () => {
    const openIssues = [makeIssue()];
    const gh = mockGitHubClient(openIssues);
    // Simulate open issues by having SDLCDoctrine check fail
    // listIssues returns issues that are "open" — we pass them to validateReleaseReadiness
    const release = new CreateRelease(gh);

    await expect(
      release.execute({ milestoneId: 1, version: "0.1.0", context: mockContext })
    ).rejects.toThrow("All sprint issues must be closed");
    expect(gh.createRelease).not.toHaveBeenCalled();
  });

  it("should create release and return correct version + tag when all closed", async () => {
    const gh = mockGitHubClient([]);
    const release = new CreateRelease(gh);

    const result = await release.execute({
      milestoneId: 1,
      version: "0.1.0",
      context: mockContext,
    });

    expect(result.version).toBe("0.1.0");
    expect(result.tag).toBe("v0.1.0");
    expect(gh.createRelease).toHaveBeenCalledTimes(1);
  });

  it("should format tag as v<version>", async () => {
    const gh = mockGitHubClient([]);
    const release = new CreateRelease(gh);

    const result = await release.execute({
      milestoneId: 1,
      version: "2.3.1",
      context: mockContext,
    });

    expect(result.tag).toBe("v2.3.1");
  });

  it("should group features in changelog correctly", async () => {
    // Pass empty open issues (listIssues for open), but provide closed issues for changelog
    const gh = mockGitHubClient([]);
    // Override listIssues: first call returns open (empty), second returns all closed
    (gh.listIssues as jest.Mock)
      .mockResolvedValueOnce([]) // open issues check
      .mockResolvedValueOnce([   // closed issues for changelog
        makeIssue({ number: 1, title: "Add login", type: IssueType.FEATURE }),
        makeIssue({ number: 2, title: "Add dashboard", type: IssueType.FEATURE }),
      ]);
    const release = new CreateRelease(gh);

    const result = await release.execute({
      milestoneId: 1,
      version: "0.1.0",
      context: mockContext,
    });

    expect(result.changelog).toContain("## Features");
    expect(result.changelog).toContain("Add dashboard (#2)");
    expect(result.changelog).toContain("Add login (#1)");
  });

  it("should group bug fixes in changelog correctly", async () => {
    const gh = mockGitHubClient([]);
    (gh.listIssues as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeIssue({ number: 3, title: "Fix crash on startup", type: IssueType.BUG }),
      ]);
    const release = new CreateRelease(gh);

    const result = await release.execute({
      milestoneId: 1,
      version: "0.1.0",
      context: mockContext,
    });

    expect(result.changelog).toContain("## Bug Fixes");
    expect(result.changelog).toContain("Fix crash on startup (#3)");
  });

  it("should omit empty groups from changelog", async () => {
    const gh = mockGitHubClient([]);
    (gh.listIssues as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeIssue({ number: 1, title: "Add login", type: IssueType.FEATURE }),
      ]);
    const release = new CreateRelease(gh);

    const result = await release.execute({
      milestoneId: 1,
      version: "0.1.0",
      context: mockContext,
    });

    expect(result.changelog).not.toContain("## Bug Fixes");
    expect(result.changelog).not.toContain("## Tasks");
  });

  it("should exclude PRD issues from changelog", async () => {
    const gh = mockGitHubClient([]);
    (gh.listIssues as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeIssue({ number: 1, title: "Product requirements", type: IssueType.PRD }),
        makeIssue({ number: 2, title: "Add login", type: IssueType.FEATURE }),
      ]);
    const release = new CreateRelease(gh);

    const result = await release.execute({
      milestoneId: 1,
      version: "0.1.0",
      context: mockContext,
    });

    expect(result.changelog).not.toContain("Product requirements");
    expect(result.changelog).toContain("Add login (#2)");
  });

  it("should sort issues alphabetically within each group", async () => {
    const gh = mockGitHubClient([]);
    (gh.listIssues as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeIssue({ number: 1, title: "Zebra feature", type: IssueType.FEATURE }),
        makeIssue({ number: 2, title: "Alpha feature", type: IssueType.FEATURE }),
        makeIssue({ number: 3, title: "Middle feature", type: IssueType.FEATURE }),
      ]);
    const release = new CreateRelease(gh);

    const result = await release.execute({
      milestoneId: 1,
      version: "0.1.0",
      context: mockContext,
    });

    const lines = result.changelog.split("\n").filter((l) => l.startsWith("- "));
    expect(lines[0]).toContain("Alpha feature");
    expect(lines[1]).toContain("Middle feature");
    expect(lines[2]).toContain("Zebra feature");
  });

  it("should call createRelease with correct tag, title, and changelog body", async () => {
    const gh = mockGitHubClient([]);
    (gh.listIssues as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const release = new CreateRelease(gh);

    await release.execute({ milestoneId: 1, version: "1.0.0", context: mockContext });

    expect(gh.createRelease).toHaveBeenCalledWith(
      "v1.0.0",
      "v1.0.0",
      expect.any(String)
    );
  });

  it("should return a valid releasedAt Date", async () => {
    const gh = mockGitHubClient([]);
    (gh.listIssues as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const release = new CreateRelease(gh);

    const result = await release.execute({
      milestoneId: 1,
      version: "0.1.0",
      context: mockContext,
    });

    expect(result.releasedAt).toBeInstanceOf(Date);
  });
});
