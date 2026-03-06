import { OctokitGitHubClient } from "../../src/infrastructure/github/OctokitGitHubClient";
import { IssueType } from "../../src/domain/models/Issue";

// Mock child_process so gh auth token fallback fails in tests
jest.mock("child_process", () => ({
  execSync: jest.fn(() => { throw new Error("gh not available"); }),
}));

// Mock @octokit/rest
const mockOctokit = {
  issues: {
    createMilestone: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    listForRepo: jest.fn(),
    update: jest.fn(),
  },
  git: {
    getRef: jest.fn(),
    createRef: jest.fn(),
  },
  pulls: {
    create: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
  },
  repos: {
    createRelease: jest.fn(),
  },
};

jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn(() => mockOctokit),
}));

describe("OctokitGitHubClient", () => {
  let client: OctokitGitHubClient;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_TOKEN = "test-token";
    client = new OctokitGitHubClient("test-owner", "test-repo");
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it("should throw if GITHUB_TOKEN is not set", () => {
    delete process.env.GITHUB_TOKEN;
    expect(() => new OctokitGitHubClient("owner", "repo")).toThrow(
      "GITHUB_TOKEN not set and gh auth token unavailable"
    );
  });

  it("should create milestone and map to domain model", async () => {
    mockOctokit.issues.createMilestone.mockResolvedValueOnce({
      data: {
        number: 1,
        title: "Sprint 1",
        description: "First sprint",
        due_on: "2026-04-01T00:00:00Z",
      },
    });

    const result = await client.createMilestone("Sprint 1", "First sprint");

    expect(result).toEqual({
      id: 1,
      title: "Sprint 1",
      description: "First sprint",
      dueDate: "2026-04-01T00:00:00Z",
      issues: [],
    });
    expect(mockOctokit.issues.createMilestone).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      title: "Sprint 1",
      description: "First sprint",
    });
  });

  it("should create issue with correct label for each IssueType", async () => {
    mockOctokit.issues.create.mockResolvedValue({
      data: {
        id: 10,
        number: 5,
        title: "Add login",
        body: "Implement login",
        labels: [{ name: "feature" }],
        milestone: { number: 1 },
      },
    });

    await client.createIssue("Add login", "Implement login", IssueType.FEATURE, 1);

    expect(mockOctokit.issues.create).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["feature"],
        milestone: 1,
      })
    );
  });

  it("should get issue and map to domain model", async () => {
    mockOctokit.issues.get.mockResolvedValueOnce({
      data: {
        id: 10,
        number: 5,
        title: "Fix bug",
        body: "Fix the null check",
        labels: [{ name: "bug" }],
        milestone: { number: 2 },
      },
    });

    const result = await client.getIssue(5);

    expect(result).toEqual({
      id: 10,
      number: 5,
      title: "Fix bug",
      body: "Fix the null check",
      type: IssueType.BUG,
      milestoneId: 2,
      branch: undefined,
    });
  });

  it("should list issues and filter by milestoneId when provided", async () => {
    mockOctokit.issues.listForRepo.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          number: 1,
          title: "Issue 1",
          body: "Body 1",
          labels: [{ name: "feature" }],
          milestone: { number: 3 },
        },
      ],
    });

    await client.listIssues(3);

    expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ milestone: 3 })
    );
  });

  it("should exclude pull requests from listIssues results", async () => {
    mockOctokit.issues.listForRepo.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          number: 1,
          title: "Real Issue",
          body: "An actual issue",
          labels: [{ name: "bug" }],
          milestone: null,
        },
        {
          id: 2,
          number: 2,
          title: "A Pull Request",
          body: "A PR masquerading as issue",
          labels: [],
          milestone: null,
          pull_request: { url: "https://api.github.com/repos/owner/repo/pulls/2" },
        },
      ],
    });

    const result = await client.listIssues();

    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
    expect(result[0].title).toBe("Real Issue");
  });

  it("should create branch by fetching SHA first then creating ref", async () => {
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: { object: { sha: "abc123" } },
    });
    mockOctokit.git.createRef.mockResolvedValueOnce({});

    await client.createBranch("feat/login", "main");

    expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      ref: "heads/main",
    });
    expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      ref: "refs/heads/feat/login",
      sha: "abc123",
    });
  });

  it("should create pull request and map to domain model", async () => {
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: {
        number: 7,
        title: "feat: add login",
        head: { ref: "feat/login" },
        base: { ref: "main" },
        state: "open",
        mergeable_state: "clean",
      },
    });

    const result = await client.createPullRequest(
      "feat: add login", "PR body", "feat/login", "main"
    );

    expect(result).toEqual({
      number: 7,
      title: "feat: add login",
      branch: "feat/login",
      base: "main",
      status: "open",
      checksPassing: true,
    });
  });

  it("should get pull request and map checksPassing from mergeable_state", async () => {
    mockOctokit.pulls.get.mockResolvedValueOnce({
      data: {
        number: 7,
        title: "feat: add login",
        head: { ref: "feat/login" },
        base: { ref: "main" },
        state: "open",
        mergeable_state: "blocked",
      },
    });

    const result = await client.getPullRequest(7);

    expect(result.checksPassing).toBe(false);
  });

  it("should close issue by calling update with state closed", async () => {
    mockOctokit.issues.update.mockResolvedValueOnce({});

    await client.closeIssue(5);

    expect(mockOctokit.issues.update).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      issue_number: 5,
      state: "closed",
    });
  });

  it("should create release with correct tag, title, and body", async () => {
    mockOctokit.repos.createRelease.mockResolvedValueOnce({});

    await client.createRelease("v1.0.0", "Release v1.0.0", "Changelog notes");

    expect(mockOctokit.repos.createRelease).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      tag_name: "v1.0.0",
      name: "Release v1.0.0",
      body: "Changelog notes",
      generate_release_notes: false,
    });
  });
});
