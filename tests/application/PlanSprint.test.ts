import { PlanSprint } from "../../src/application/use-cases/PlanSprint";
import { GitHubClient } from "../../src/domain/interfaces/GitHubClient";
import { PromptGenerator } from "../../src/domain/interfaces/PromptGenerator";
import { IssueType, Issue } from "../../src/domain/models/Issue";
import { Milestone } from "../../src/domain/models/Milestone";
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

const validPlanResponse = JSON.stringify({
  architectureIssues: [
    { title: "Define domain models", body: "Create Issue, Milestone, PR interfaces" },
  ],
  featureIssues: [
    { title: "Implement login", body: "OAuth2 login flow" },
    { title: "Implement dashboard", body: "User dashboard with metrics" },
  ],
  taskIssues: [
    { title: "Create login form component", body: "React form", featureRef: "Implement login" },
    { title: "Add auth middleware", body: "JWT validation", featureRef: "Implement login" },
  ],
});

let issueCounter: number;

function mockGitHubClient(): GitHubClient {
  issueCounter = 0;
  return {
    createMilestone: jest.fn().mockResolvedValue({
      id: 1,
      title: "Sprint 1",
      description: "First sprint",
      issues: [],
    } satisfies Milestone),
    createIssue: jest.fn().mockImplementation(
      (title: string, body: string, type: IssueType, milestoneId: number): Promise<Issue> => {
        issueCounter++;
        return Promise.resolve({
          id: issueCounter,
          number: issueCounter,
          title,
          body,
          type,
          milestoneId,
        });
      }
    ),
    getIssue: jest.fn(),
    listIssues: jest.fn(),
    createBranch: jest.fn(),
    createPullRequest: jest.fn(),
    getPullRequest: jest.fn(),
    listOpenPullRequests: jest.fn(),
    closeIssue: jest.fn(),
    createRelease: jest.fn(),
  };
}

function mockPromptGenerator(): PromptGenerator {
  return {
    generateImplementationPrompt: jest.fn(),
    generatePlanningPrompt: jest.fn().mockResolvedValue(validPlanResponse),
  };
}

describe("PlanSprint", () => {
  it("should create milestone then all issues in correct order", async () => {
    const gh = mockGitHubClient();
    const prompt = mockPromptGenerator();
    const planner = new PlanSprint(gh, prompt, mockContext);

    const result = await planner.execute({
      prdContent: "Build a SaaS app",
      milestoneTitle: "Sprint 1",
      milestoneDescription: "First sprint",
    });

    expect(gh.createMilestone).toHaveBeenCalledTimes(1);
    expect(gh.createIssue).toHaveBeenCalledTimes(5); // 1 arch + 2 feat + 2 task
    expect(result.issues).toHaveLength(5);
  });

  it("should create architecture issues before feature issues", async () => {
    const gh = mockGitHubClient();
    const prompt = mockPromptGenerator();
    const planner = new PlanSprint(gh, prompt, mockContext);

    await planner.execute({
      prdContent: "Build a SaaS app",
      milestoneTitle: "Sprint 1",
      milestoneDescription: "First sprint",
    });

    const calls = (gh.createIssue as jest.Mock).mock.calls;
    expect(calls[0][2]).toBe(IssueType.ARCHITECTURE); // first call is arch
    expect(calls[1][2]).toBe(IssueType.FEATURE);       // then features
  });

  it("should create feature issues before task issues", async () => {
    const gh = mockGitHubClient();
    const prompt = mockPromptGenerator();
    const planner = new PlanSprint(gh, prompt, mockContext);

    await planner.execute({
      prdContent: "Build a SaaS app",
      milestoneTitle: "Sprint 1",
      milestoneDescription: "First sprint",
    });

    const calls = (gh.createIssue as jest.Mock).mock.calls;
    const types = calls.map((c: unknown[]) => c[2]);
    const lastFeatureIdx = types.lastIndexOf(IssueType.FEATURE);
    const firstTaskIdx = types.indexOf(IssueType.TASK);
    expect(lastFeatureIdx).toBeLessThan(firstTaskIdx);
  });

  it("should assign all issues to the created milestone", async () => {
    const gh = mockGitHubClient();
    const prompt = mockPromptGenerator();
    const planner = new PlanSprint(gh, prompt, mockContext);

    await planner.execute({
      prdContent: "Build a SaaS app",
      milestoneTitle: "Sprint 1",
      milestoneDescription: "First sprint",
    });

    const calls = (gh.createIssue as jest.Mock).mock.calls;
    for (const call of calls) {
      expect(call[3]).toBe(1); // milestoneId = 1
    }
  });

  it("should return Sprint with status 'active'", async () => {
    const gh = mockGitHubClient();
    const prompt = mockPromptGenerator();
    const planner = new PlanSprint(gh, prompt, mockContext);

    const result = await planner.execute({
      prdContent: "Build a SaaS app",
      milestoneTitle: "Sprint 1",
      milestoneDescription: "First sprint",
    });

    expect(result.status).toBe("active");
  });

  it("should call PromptGenerator with PRD content and project context", async () => {
    const gh = mockGitHubClient();
    const prompt = mockPromptGenerator();
    const planner = new PlanSprint(gh, prompt, mockContext);

    await planner.execute({
      prdContent: "Build a SaaS app",
      milestoneTitle: "Sprint 1",
      milestoneDescription: "First sprint",
    });

    expect(prompt.generatePlanningPrompt).toHaveBeenCalledWith(
      "Build a SaaS app",
      mockContext
    );
  });

  it("should throw if architectureIssues is empty", async () => {
    const gh = mockGitHubClient();
    const prompt: PromptGenerator = {
      generateImplementationPrompt: jest.fn(),
      generatePlanningPrompt: jest.fn().mockResolvedValue(
        JSON.stringify({
          architectureIssues: [],
          featureIssues: [{ title: "Feat", body: "Body" }],
          taskIssues: [],
        })
      ),
    };
    const planner = new PlanSprint(gh, prompt, mockContext);

    await expect(
      planner.execute({
        prdContent: "Build something",
        milestoneTitle: "Sprint 1",
        milestoneDescription: "First sprint",
      })
    ).rejects.toThrow("PRD must produce at least one architecture issue");
  });

  it("should call createIssue with correct IssueType per issue category", async () => {
    const gh = mockGitHubClient();
    const prompt = mockPromptGenerator();
    const planner = new PlanSprint(gh, prompt, mockContext);

    await planner.execute({
      prdContent: "Build a SaaS app",
      milestoneTitle: "Sprint 1",
      milestoneDescription: "First sprint",
    });

    const calls = (gh.createIssue as jest.Mock).mock.calls;
    expect(calls[0][2]).toBe(IssueType.ARCHITECTURE);
    expect(calls[1][2]).toBe(IssueType.FEATURE);
    expect(calls[2][2]).toBe(IssueType.FEATURE);
    expect(calls[3][2]).toBe(IssueType.TASK);
    expect(calls[4][2]).toBe(IssueType.TASK);
  });
});
