import { ImplementIssue } from "../../src/application/use-cases/ImplementIssue";
import { GitHubClient } from "../../src/domain/interfaces/GitHubClient";
import { BranchConflictResolver } from "../../src/domain/interfaces/BranchConflictResolver";
import { PromptGenerator } from "../../src/domain/interfaces/PromptGenerator";
import { IssueType, Issue } from "../../src/domain/models/Issue";
import { ProjectContext } from "../../src/domain/models/ProjectContext";
import { BranchConflictAction } from "../../src/domain/models/BranchConflictAction";

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
    title: "Add user authentication",
    body: "Implement OAuth2 login flow",
    type: IssueType.FEATURE,
    milestoneId: 1,
    ...overrides,
  };
}

function mockGitHubClient(issue: Issue, branchAlreadyExists = false): GitHubClient {
  return {
    createMilestone: jest.fn(),
    createIssue: jest.fn(),
    getIssue: jest.fn().mockResolvedValue(issue),
    listIssues: jest.fn(),
    createBranch: jest.fn().mockResolvedValue(undefined),
    branchExists: jest.fn().mockResolvedValue(branchAlreadyExists),
    deleteBranch: jest.fn().mockResolvedValue(undefined),
    createPullRequest: jest.fn(),
    getPullRequest: jest.fn(),
    listOpenPullRequests: jest.fn(),
    closeIssue: jest.fn(),
    createRelease: jest.fn(),
  };
}

function mockPromptGenerator(): PromptGenerator {
  return {
    generateImplementationPrompt: jest.fn().mockResolvedValue("Generated Claude Code prompt for issue #42"),
    generatePlanningPrompt: jest.fn(),
  };
}

function mockResolver(action: BranchConflictAction): BranchConflictResolver {
  return {
    resolve: jest.fn().mockResolvedValue(action),
  };
}

describe("ImplementIssue", () => {
  it("should create feat/ branch for FEATURE issue and return prompt + nextSteps", async () => {
    const issue = makeIssue({ type: IssueType.FEATURE, title: "Add user authentication" });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    const result = await impl.execute({ issueNumber: 42, context: mockContext });

    expect(result.branch).toBe("feat/add-user-authentication");
    expect(result.prompt).toContain("Claude Code prompt");
    expect(result.nextSteps).toHaveLength(5);
    expect(gh.createBranch).toHaveBeenCalledWith("feat/add-user-authentication", "main");
  });

  it("should create fix/ branch for BUG issue", async () => {
    const issue = makeIssue({ type: IssueType.BUG, title: "Fix null pointer" });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    const result = await impl.execute({ issueNumber: 42, context: mockContext });

    expect(result.branch).toBe("fix/fix-null-pointer");
  });

  it("should create chore/ branch for TASK issue", async () => {
    const issue = makeIssue({ type: IssueType.TASK, title: "Update dependencies" });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    const result = await impl.execute({ issueNumber: 42, context: mockContext });

    expect(result.branch).toBe("chore/update-dependencies");
  });

  it("should create feat/architecture-<number> branch for ARCHITECTURE issue", async () => {
    const issue = makeIssue({ type: IssueType.ARCHITECTURE, number: 7, title: "Define domain models" });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    const result = await impl.execute({ issueNumber: 7, context: mockContext });

    expect(result.branch).toBe("feat/architecture-7");
  });

  it("should throw if issue has no milestone — branch NOT created", async () => {
    const issue = makeIssue({ milestoneId: undefined });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    await expect(impl.execute({ issueNumber: 42, context: mockContext })).rejects.toThrow(
      "Issue must belong to a milestone"
    );
    expect(gh.createBranch).not.toHaveBeenCalled();
  });

  it("should throw if issue type is PRD — branch NOT created", async () => {
    const issue = makeIssue({ type: IssueType.PRD });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    await expect(impl.execute({ issueNumber: 42, context: mockContext })).rejects.toThrow(
      "Cannot implement a PRD issue directly"
    );
    expect(gh.createBranch).not.toHaveBeenCalled();
  });

  it("should call PromptGenerator with issue and full ProjectContext", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    await impl.execute({ issueNumber: 42, context: mockContext });

    expect(prompt.generateImplementationPrompt).toHaveBeenCalledWith(issue, mockContext);
  });

  it("should return nextSteps with 5 items in correct order", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    const result = await impl.execute({ issueNumber: 42, context: mockContext });

    expect(result.nextSteps[0]).toContain("Open Claude Code");
    expect(result.nextSteps[1]).toContain("Switch to branch");
    expect(result.nextSteps[1]).toContain("feat/add-user-authentication");
    expect(result.nextSteps[2]).toContain("Paste the generated prompt");
    expect(result.nextSteps[3]).toContain("npm test");
    expect(result.nextSteps[4]).toContain("cforge-dev verify 42");
  });

  it("should slugify branch name correctly", async () => {
    const issue = makeIssue({ type: IssueType.FEATURE, title: "Add User   Authentication!" });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    const result = await impl.execute({ issueNumber: 42, context: mockContext });

    expect(result.branch).toBe("feat/add-user-authentication");
  });

  it("should always create branch from 'main'", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    await impl.execute({ issueNumber: 42, context: mockContext });

    expect(gh.createBranch).toHaveBeenCalledWith(
      expect.any(String),
      "main"
    );
  });

  // Branch conflict scenarios

  it("branch already exists, no resolver → throws with branch-exists error", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue, true);
    const prompt = mockPromptGenerator();
    const impl = new ImplementIssue(gh, prompt);

    await expect(impl.execute({ issueNumber: 42, context: mockContext })).rejects.toThrow(
      "already exists"
    );
    expect(gh.createBranch).not.toHaveBeenCalled();
    expect(gh.deleteBranch).not.toHaveBeenCalled();
  });

  it("branch already exists, user chooses continue → createBranch NOT called, returns result", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue, true);
    const prompt = mockPromptGenerator();
    const resolver = mockResolver("continue");
    const impl = new ImplementIssue(gh, prompt, resolver);

    const result = await impl.execute({ issueNumber: 42, context: mockContext });

    expect(result.branch).toBe("feat/add-user-authentication");
    expect(gh.createBranch).not.toHaveBeenCalled();
    expect(gh.deleteBranch).not.toHaveBeenCalled();
    expect(resolver.resolve).toHaveBeenCalledWith("feat/add-user-authentication");
  });

  it("branch already exists, user chooses reset → deleteBranch then createBranch called", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue, true);
    const prompt = mockPromptGenerator();
    const resolver = mockResolver("reset");
    const impl = new ImplementIssue(gh, prompt, resolver);

    const result = await impl.execute({ issueNumber: 42, context: mockContext });

    expect(result.branch).toBe("feat/add-user-authentication");
    expect(gh.deleteBranch).toHaveBeenCalledWith("feat/add-user-authentication");
    expect(gh.createBranch).toHaveBeenCalledWith("feat/add-user-authentication", "main");
  });

  it("branch already exists, user chooses abort → throws abort error, no branch changes", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue, true);
    const prompt = mockPromptGenerator();
    const resolver = mockResolver("abort");
    const impl = new ImplementIssue(gh, prompt, resolver);

    await expect(impl.execute({ issueNumber: 42, context: mockContext })).rejects.toThrow(
      "Aborted"
    );
    expect(gh.createBranch).not.toHaveBeenCalled();
    expect(gh.deleteBranch).not.toHaveBeenCalled();
  });
});
