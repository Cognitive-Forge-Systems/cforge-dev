import { RepoStateLoader } from "../../src/application/use-cases/RepoStateLoader";
import { GitHubClient } from "../../src/domain/interfaces/GitHubClient";
import { IssueType, Issue } from "../../src/domain/models/Issue";

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
    listOpenPullRequests: jest.fn().mockResolvedValue([]),
    closeIssue: jest.fn(),
    createRelease: jest.fn(),
    branchExists: jest.fn().mockResolvedValue(false),
    deleteBranch: jest.fn().mockResolvedValue(undefined),
  };
}

describe("RepoStateLoader", () => {
  it("should fetch open issues and PRs in parallel (both called once)", async () => {
    const gh = mockGitHubClient([makeIssue()]);
    const loader = new RepoStateLoader(gh);

    await loader.execute();

    expect(gh.listIssues).toHaveBeenCalledTimes(1);
    expect(gh.listOpenPullRequests).toHaveBeenCalledTimes(1);
  });

  it("should return activeMilestone: null when no milestones exist", async () => {
    const gh = mockGitHubClient([]);
    const loader = new RepoStateLoader(gh);

    const result = await loader.execute();

    expect(result.activeMilestone).toBeNull();
  });

  it("should return RepoState with correct issue count", async () => {
    const issues = [
      makeIssue({ number: 1, title: "Issue one" }),
      makeIssue({ number: 2, title: "Issue two" }),
    ];
    const gh = mockGitHubClient(issues);
    const loader = new RepoStateLoader(gh);

    const result = await loader.execute();

    expect(result.openIssues).toHaveLength(2);
  });
});
