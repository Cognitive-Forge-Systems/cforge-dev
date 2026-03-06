import { SDLCDoctrine } from "../../src/domain/engines/SDLCDoctrine";
import { Issue, IssueType } from "../../src/domain/models/Issue";
import { PullRequest } from "../../src/domain/models/PullRequest";

const doctrine = new SDLCDoctrine();

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 1,
    number: 1,
    title: "Test issue",
    body: "Test body",
    type: IssueType.FEATURE,
    milestoneId: 1,
    ...overrides,
  };
}

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 1,
    title: "Test PR",
    branch: "feat/test",
    base: "main",
    status: "open",
    checksPassing: true,
    ...overrides,
  };
}

describe("SDLCDoctrine", () => {
  describe("validateIssueForImplementation", () => {
    it("should throw if issue has no milestoneId", () => {
      const issue = makeIssue({ milestoneId: undefined });
      expect(() => doctrine.validateIssueForImplementation(issue)).toThrow(
        "Issue must belong to a milestone"
      );
    });

    it("should throw if issue type is PRD", () => {
      const issue = makeIssue({ type: IssueType.PRD });
      expect(() => doctrine.validateIssueForImplementation(issue)).toThrow(
        "Cannot implement a PRD issue directly"
      );
    });
  });

  describe("validateBranchName", () => {
    it("should accept feat/ prefix for FEATURE issues", () => {
      const issue = makeIssue({ type: IssueType.FEATURE });
      expect(() => doctrine.validateBranchName("feat/add-login", issue)).not.toThrow();
    });

    it("should accept fix/ prefix for BUG issues", () => {
      const issue = makeIssue({ type: IssueType.BUG });
      expect(() => doctrine.validateBranchName("fix/null-check", issue)).not.toThrow();
    });

    it("should accept chore/ prefix for TASK issues", () => {
      const issue = makeIssue({ type: IssueType.TASK });
      expect(() => doctrine.validateBranchName("chore/update-deps", issue)).not.toThrow();
    });

    it("should throw if branch name has wrong prefix for issue type", () => {
      const issue = makeIssue({ type: IssueType.FEATURE });
      expect(() => doctrine.validateBranchName("fix/wrong-prefix", issue)).toThrow(
        "Branch name invalid"
      );
    });
  });

  describe("validatePRReadiness", () => {
    it("should throw if PR base is not main", () => {
      const pr = makePR({ base: "develop" });
      expect(() => doctrine.validatePRReadiness(pr, true)).toThrow(
        "PR base must be main"
      );
    });

    it("should throw if tests are not passing", () => {
      const pr = makePR();
      expect(() => doctrine.validatePRReadiness(pr, false)).toThrow(
        "Tests must pass before PR is ready"
      );
    });
  });

  describe("validateReleaseReadiness", () => {
    it("should throw if there are open issues", () => {
      const openIssues = [makeIssue()];
      expect(() => doctrine.validateReleaseReadiness(openIssues)).toThrow(
        "All sprint issues must be closed"
      );
    });

    it("should pass if there are no open issues", () => {
      expect(() => doctrine.validateReleaseReadiness([])).not.toThrow();
    });
  });
});
