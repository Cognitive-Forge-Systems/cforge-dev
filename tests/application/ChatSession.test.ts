import { ChatSession } from "../../src/application/use-cases/ChatSession";
import { ProjectContext } from "../../src/domain/models/ProjectContext";
import { RepoState } from "../../src/domain/models/RepoState";
import { IssueType, Issue } from "../../src/domain/models/Issue";
import { PullRequest } from "../../src/domain/models/PullRequest";

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

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 10,
    title: "feat: add login",
    branch: "feat/add-login",
    base: "main",
    status: "open",
    checksPassing: true,
    ...overrides,
  };
}

function makeRepoState(overrides: Partial<RepoState> = {}): RepoState {
  return {
    openIssues: [makeIssue()],
    openPullRequests: [],
    activeMilestone: null,
    recentReleases: ["v0.1.0"],
    ...overrides,
  };
}

describe("ChatSession", () => {
  it("should start with empty history and default model", () => {
    const session = new ChatSession(mockContext, makeRepoState());

    expect(session.history).toHaveLength(0);
    expect(session.model).toBe("openai/gpt-4o");
  });

  it("should append messages to history via addMessage", () => {
    const session = new ChatSession(mockContext, makeRepoState());

    session.addMessage("user", "Hello");
    session.addMessage("assistant", "Hi there");

    expect(session.history).toHaveLength(2);
    expect(session.history[0]).toEqual({ role: "user", content: "Hello" });
    expect(session.history[1]).toEqual({ role: "assistant", content: "Hi there" });
  });

  it("should return system prompt as first message in buildMessages", () => {
    const session = new ChatSession(mockContext, makeRepoState());
    session.addMessage("user", "Hello");

    const messages = session.buildMessages();

    expect(messages[0].role).toBe("system");
    expect(messages[1]).toEqual({ role: "user", content: "Hello" });
  });

  it("should include ProjectContext stack in system prompt", () => {
    const session = new ChatSession(mockContext, makeRepoState());

    const messages = session.buildMessages();

    expect(messages[0].content).toContain("TypeScript");
  });

  it("should include RepoState open issues in system prompt", () => {
    const repoState = makeRepoState({
      openIssues: [makeIssue({ number: 42, title: "Add login" })],
    });
    const session = new ChatSession(mockContext, repoState);

    const messages = session.buildMessages();

    expect(messages[0].content).toContain("Add login");
    expect(messages[0].content).toContain("#42");
  });

  it("should include Claude Code prompt generation instructions in system prompt", () => {
    const session = new ChatSession(mockContext, makeRepoState());

    const messages = session.buildMessages();

    expect(messages[0].content).toContain("══ CLAUDE CODE PROMPT ══");
  });

  it("should format open issues as numbered list in getRepoSummary", () => {
    const repoState = makeRepoState({
      openIssues: [makeIssue({ number: 42, title: "Add login" })],
    });
    const session = new ChatSession(mockContext, repoState);

    const summary = session.getRepoSummary();

    expect(summary).toContain("#42");
    expect(summary).toContain("Add login");
  });

  it("should show 'none' when no open PRs in getRepoSummary", () => {
    const repoState = makeRepoState({ openPullRequests: [] });
    const session = new ChatSession(mockContext, repoState);

    const summary = session.getRepoSummary();

    expect(summary).toContain("none");
  });
});
