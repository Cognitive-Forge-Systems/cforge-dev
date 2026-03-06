import { VerifyIssue } from "../../src/application/use-cases/VerifyIssue";
import { GitHubClient } from "../../src/domain/interfaces/GitHubClient";
import { PromptGenerator } from "../../src/domain/interfaces/PromptGenerator";
import { IssueType, Issue } from "../../src/domain/models/Issue";
import { PullRequest } from "../../src/domain/models/PullRequest";
import { ProjectContext } from "../../src/domain/models/ProjectContext";

const mockContext: ProjectContext = {
  repoOwner: "test-owner",
  repoName: "test-repo",
  stack: "TypeScript",
  architecture: "Clean Architecture",
  rules: ["TDD-first"],
  existingModules: [],
  openQuestions: [],
};

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 1,
    number: 42,
    title: "Add login",
    body: "Implement OAuth2 login",
    type: IssueType.FEATURE,
    milestoneId: 1,
    branch: "feat/add-login",
    ...overrides,
  };
}

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 10,
    title: "feat: add login",
    branch: "feat/add-login",
    base: "main",
    status: "open",
    checksPassing: true,
    body: undefined,
    ...overrides,
  };
}

function mockGitHubClient(issue: Issue, prs: PullRequest[]): GitHubClient {
  return {
    createMilestone: jest.fn(),
    createIssue: jest.fn(),
    getIssue: jest.fn().mockResolvedValue(issue),
    listIssues: jest.fn(),
    createBranch: jest.fn(),
    createPullRequest: jest.fn(),
    getPullRequest: jest.fn(),
    listOpenPullRequests: jest.fn().mockResolvedValue(prs),
    closeIssue: jest.fn(),
    createRelease: jest.fn(),
  };
}

function mockPromptGenerator(): PromptGenerator {
  return {
    generateImplementationPrompt: jest.fn().mockResolvedValue("Critique feedback on the implementation"),
    generatePlanningPrompt: jest.fn(),
  };
}

describe("VerifyIssue", () => {
  it("should return ready: true with no blockers when PR is valid and checks pass", async () => {
    const issue = makeIssue();
    const pr = makePR();
    const gh = mockGitHubClient(issue, [pr]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.pr).toEqual(pr);
  });

  it("should return ready: false with blocker when PR base is not main", async () => {
    const issue = makeIssue();
    const pr = makePR({ base: "develop" });
    const gh = mockGitHubClient(issue, [pr]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("PR must target main branch");
  });

  it("should return ready: false with blocker when checks are failing", async () => {
    const issue = makeIssue();
    const pr = makePR({ checksPassing: false });
    const gh = mockGitHubClient(issue, [pr]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("All checks must pass before merge");
  });

  it("should return ready: false with blocker when no open PR found", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue, []);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("No open PR found for this issue");
  });

  it("should always run critique regardless of ready state", async () => {
    const issue = makeIssue();
    const pr = makePR({ checksPassing: false });
    const gh = mockGitHubClient(issue, [pr]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.critique).toBeDefined();
    expect(result.critique.length).toBeGreaterThan(0);
    expect(prompt.generateImplementationPrompt).toHaveBeenCalled();
  });

  it("should call PromptGenerator with issue body + PR body as content", async () => {
    const issue = makeIssue({ body: "Issue body content" });
    const pr = makePR({ title: "PR title" });
    const gh = mockGitHubClient(issue, [pr]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    await verify.execute({ issueNumber: 42, context: mockContext });

    const call = (prompt.generateImplementationPrompt as jest.Mock).mock.calls[0];
    const passedIssue = call[0] as Issue;
    expect(passedIssue.body).toContain("Issue body content");
  });

  it("should return 3 nextSteps when ready", async () => {
    const issue = makeIssue();
    const pr = makePR();
    const gh = mockGitHubClient(issue, [pr]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.nextSteps).toHaveLength(3);
    expect(result.nextSteps[0]).toContain("Review the PR");
    expect(result.nextSteps[1]).toContain("gh pr merge");
    expect(result.nextSteps[1]).toContain("10");
    expect(result.nextSteps[2]).toContain("cforge-dev release");
  });

  it("should return one nextStep per blocker when blocked", async () => {
    const issue = makeIssue();
    const pr = makePR({ checksPassing: false });
    const gh = mockGitHubClient(issue, [pr]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.nextSteps.length).toBe(result.blockers.length);
  });

  it("should collect multiple blockers when multiple issues exist", async () => {
    const issue = makeIssue();
    const pr = makePR({ base: "develop", checksPassing: false });
    const gh = mockGitHubClient(issue, [pr]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.ready).toBe(false);
    expect(result.blockers.length).toBeGreaterThanOrEqual(2);
    expect(result.blockers).toContain("PR must target main branch");
    expect(result.blockers).toContain("All checks must pass before merge");
  });

  it("should match PR to issue by branch name containing issue-related prefix", async () => {
    const issue = makeIssue({ branch: "feat/add-login" });
    const unrelatedPR = makePR({ branch: "fix/other-thing", number: 99 });
    const matchingPR = makePR({ branch: "feat/add-login", number: 10 });
    const gh = mockGitHubClient(issue, [unrelatedPR, matchingPR]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.pr?.number).toBe(10);
  });

  it("should match ARCHITECTURE issue PR by feat/architecture-<number> branch", async () => {
    const issue = makeIssue({ number: 2, type: IssueType.ARCHITECTURE, title: "Setup architecture", branch: undefined });
    const archPR = makePR({ branch: "feat/architecture-2", number: 14 });
    const unrelatedPR = makePR({ branch: "feat/other-thing", number: 99 });
    const gh = mockGitHubClient(issue, [unrelatedPR, archPR]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 2, context: mockContext });

    expect(result.pr?.number).toBe(14);
  });

  it("should match FEATURE issue PR by computed slug branch when issue.branch is undefined", async () => {
    const issue = makeIssue({ number: 5, type: IssueType.FEATURE, title: "Add login", branch: undefined });
    const matchingPR = makePR({ branch: "feat/add-login", number: 20 });
    const gh = mockGitHubClient(issue, [matchingPR]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 5, context: mockContext });

    expect(result.pr?.number).toBe(20);
  });

  it("should match BUG issue PR by fix/ prefixed branch", async () => {
    const issue = makeIssue({ number: 7, type: IssueType.BUG, title: "Fix crash on login", branch: undefined });
    const matchingPR = makePR({ branch: "fix/fix-crash-on-login", number: 21 });
    const unrelatedPR = makePR({ branch: "feat/other", number: 99 });
    const gh = mockGitHubClient(issue, [unrelatedPR, matchingPR]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 7, context: mockContext });

    expect(result.pr?.number).toBe(21);
  });

  it("should match TASK issue PR by chore/ prefixed branch", async () => {
    const issue = makeIssue({ number: 8, type: IssueType.TASK, title: "Update dependencies", branch: undefined });
    const matchingPR = makePR({ branch: "chore/update-dependencies", number: 22 });
    const unrelatedPR = makePR({ branch: "feat/other", number: 99 });
    const gh = mockGitHubClient(issue, [unrelatedPR, matchingPR]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 8, context: mockContext });

    expect(result.pr?.number).toBe(22);
  });

  it("should use issue number fallback to match PR when branch contains the issue number", async () => {
    const issue = makeIssue({ number: 42, type: IssueType.FEATURE, title: "Some feature", branch: undefined });
    const matchingPR = makePR({ branch: "feat/some-unrelated-42", number: 30 });
    const gh = mockGitHubClient(issue, [matchingPR]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.pr?.number).toBe(30);
  });

  it("should match PR by issue number in PR body (Closes #<number>)", async () => {
    const issue = makeIssue({ number: 42, type: IssueType.FEATURE, title: "Unrelated title xyz", branch: undefined });
    const matchingPR = makePR({ branch: "feat/completely-different-branch", number: 31, body: "Closes #42" });
    const gh = mockGitHubClient(issue, [matchingPR]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 42, context: mockContext });

    expect(result.pr?.number).toBe(31);
  });

  it("should return null pr when no PR matches any strategy", async () => {
    const issue = makeIssue({ number: 99, type: IssueType.FEATURE, title: "Unmatched feature", branch: undefined });
    const unrelatedPR = makePR({ branch: "fix/something-else", number: 50, body: "No issue reference" });
    const gh = mockGitHubClient(issue, [unrelatedPR]);
    const prompt = mockPromptGenerator();
    const verify = new VerifyIssue(gh, prompt);

    const result = await verify.execute({ issueNumber: 99, context: mockContext });

    expect(result.pr).toBeNull();
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("No open PR found for this issue");
  });
});
