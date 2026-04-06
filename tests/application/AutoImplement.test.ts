jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

import { AutoImplement } from "../../src/application/use-cases/AutoImplement";
import { GitHubClient } from "../../src/domain/interfaces/GitHubClient";
import { PromptGenerator } from "../../src/domain/interfaces/PromptGenerator";
import { CodeRunner, RunResult } from "../../src/domain/interfaces/CodeRunner";
import { IssueType, Issue } from "../../src/domain/models/Issue";
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
    ...overrides,
  };
}

function makeRunResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    success: true,
    output: "Implementation complete. All tests pass.",
    cost: 0.05,
    turns: 3,
    stopReason: "end_turn",
    ...overrides,
  };
}

function mockGitHubClient(issue: Issue): GitHubClient {
  return {
    createMilestone: jest.fn(),
    createIssue: jest.fn(),
    getIssue: jest.fn().mockResolvedValue(issue),
    listIssues: jest.fn(),
    createBranch: jest.fn(),
    createPullRequest: jest.fn().mockResolvedValue({
      number: 100,
      title: "feat: add login",
      branch: "feat/add-login",
      base: "main",
      status: "open",
      checksPassing: false,
    }),
    getPullRequest: jest.fn(),
    listOpenPullRequests: jest.fn(),
    closeIssue: jest.fn(),
    createRelease: jest.fn(),
  };
}

function mockPromptGenerator(): PromptGenerator {
  return {
    generateImplementationPrompt: jest.fn().mockResolvedValue("Implement the login feature with TDD"),
    generatePlanningPrompt: jest.fn(),
  };
}

function mockCodeRunner(result: RunResult): CodeRunner {
  return {
    run: jest.fn().mockResolvedValue(result),
  };
}

function mockTestRunner(passes: boolean): (dir: string) => Promise<{ passed: boolean; output: string }> {
  return jest.fn().mockResolvedValue({ passed: passes, output: passes ? "All tests pass" : "FAIL: 2 tests failed\nExpected X got Y" });
}

describe("AutoImplement", () => {
  it("valid issue → full pipeline executes, PR opened", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner = mockCodeRunner(makeRunResult());
    const testRunner = mockTestRunner(true);
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    const result = await auto.execute({ issueNumber: 42, context: mockContext });

    expect(result.success).toBe(true);
    expect(result.testsPassed).toBe(true);
    expect(result.prNumber).toBeDefined();
    expect(result.prUrl).toBeDefined();
  });

  it("SDLCDoctrine validation fails → throws before CodeRunner called", async () => {
    const issue = makeIssue({ type: IssueType.PRD });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner = mockCodeRunner(makeRunResult());
    const testRunner = mockTestRunner(true);
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    await expect(auto.execute({ issueNumber: 42, context: mockContext })).rejects.toThrow(
      "Cannot implement a PRD issue directly"
    );
    expect(runner.run).not.toHaveBeenCalled();
  });

  it("CodeRunner fails → success: false, no PR opened", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner = mockCodeRunner(makeRunResult({ success: false, output: "Claude failed" }));
    const testRunner = mockTestRunner(false);
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    const result = await auto.execute({ issueNumber: 42, context: mockContext });

    expect(result.success).toBe(false);
    expect(gh.createPullRequest).not.toHaveBeenCalled();
  });

  it("budget exhaustion → error message mentions --max-budget", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner = mockCodeRunner(makeRunResult({
      success: false,
      output: "Hit max budget",
      cost: 5.0,
      turns: 12,
      stopReason: "max_budget_reached",
    }));
    const testRunner = mockTestRunner(false);
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    const result = await auto.execute({ issueNumber: 42, context: mockContext });

    expect(result.success).toBe(false);
    expect(result.stopReason).toBe("max_budget_reached");
    expect(result.error).toContain("Budget limit reached");
    expect(result.error).toContain("--max-budget");
    expect(result.error).toContain("$5.00");
  });

  it("tests fail first attempt → retries with error context", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner: CodeRunner = {
      run: jest.fn()
        .mockResolvedValueOnce(makeRunResult())
        .mockResolvedValueOnce(makeRunResult()),
    };
    const testRunner = jest.fn()
      .mockResolvedValueOnce({ passed: false, output: "FAIL: test error" })
      .mockResolvedValueOnce({ passed: true, output: "All tests pass" });
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    const result = await auto.execute({ issueNumber: 42, context: mockContext });

    expect(runner.run).toHaveBeenCalledTimes(2);
    const secondPrompt = (runner.run as jest.Mock).mock.calls[1][0];
    expect(secondPrompt).toContain("FAIL: test error");
  });

  it("tests fail on retry → returns manualStepsRequired with 4 items", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner = mockCodeRunner(makeRunResult());
    const testRunner = mockTestRunner(false);
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    const result = await auto.execute({ issueNumber: 42, context: mockContext });

    expect(result.success).toBe(false);
    expect(result.manualStepsRequired).toHaveLength(4);
  });

  it("tests pass → PR opened with correct body containing issue title", async () => {
    const issue = makeIssue({ number: 42, title: "Add login" });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner = mockCodeRunner(makeRunResult());
    const testRunner = mockTestRunner(true);
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    await auto.execute({ issueNumber: 42, context: mockContext });

    expect(gh.createPullRequest).toHaveBeenCalledTimes(1);
    const callArgs = (gh.createPullRequest as jest.Mock).mock.calls[0];
    expect(callArgs[1]).toContain("Add login");
  });

  it("cost and turns from RunResult included in AutoImplementResult", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner = mockCodeRunner(makeRunResult({ cost: 0.05, turns: 3 }));
    const testRunner = mockTestRunner(true);
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    const result = await auto.execute({ issueNumber: 42, context: mockContext });

    expect(result.cost).toBe(0.05);
    expect(result.turns).toBe(3);
  });

  it("PR body contains 'Closes #<number>'", async () => {
    const issue = makeIssue({ number: 42 });
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner = mockCodeRunner(makeRunResult());
    const testRunner = mockTestRunner(true);
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    await auto.execute({ issueNumber: 42, context: mockContext });

    const callArgs = (gh.createPullRequest as jest.Mock).mock.calls[0];
    expect(callArgs[1]).toContain("Closes #42");
  });

  it("retried: true when retry was needed", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner: CodeRunner = {
      run: jest.fn()
        .mockResolvedValueOnce(makeRunResult())
        .mockResolvedValueOnce(makeRunResult()),
    };
    const testRunner = jest.fn()
      .mockResolvedValueOnce({ passed: false, output: "FAIL" })
      .mockResolvedValueOnce({ passed: true, output: "OK" });
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    const result = await auto.execute({ issueNumber: 42, context: mockContext });

    expect(result.retried).toBe(true);
  });

  it("retried: false when first attempt succeeds", async () => {
    const issue = makeIssue();
    const gh = mockGitHubClient(issue);
    const prompt = mockPromptGenerator();
    const runner = mockCodeRunner(makeRunResult());
    const testRunner = mockTestRunner(true);
    const auto = new AutoImplement(gh, prompt, runner, testRunner);

    const result = await auto.execute({ issueNumber: 42, context: mockContext });

    expect(result.retried).toBe(false);
  });
});
