import { Issue, IssueType } from "../models/Issue";
import { PullRequest } from "../models/PullRequest";

const BRANCH_PREFIX_MAP: Partial<Record<IssueType, string>> = {
  [IssueType.FEATURE]: "feat/",
  [IssueType.BUG]: "fix/",
  [IssueType.TASK]: "chore/",
  [IssueType.ARCHITECTURE]: "feat/",
};

export class SDLCDoctrine {
  validateIssueForImplementation(issue: Issue): void {
    if (issue.milestoneId === undefined) {
      throw new Error("Issue must belong to a milestone");
    }
    if (issue.type === IssueType.PRD) {
      throw new Error("Cannot implement a PRD issue directly");
    }
  }

  validateBranchName(branch: string, issue: Issue): void {
    const expectedPrefix = BRANCH_PREFIX_MAP[issue.type];
    if (expectedPrefix && !branch.startsWith(expectedPrefix)) {
      throw new Error(
        `Branch name invalid: expected prefix "${expectedPrefix}" for ${issue.type} issue, got "${branch}"`
      );
    }
  }

  validatePRReadiness(pr: PullRequest, testsPassing: boolean): void {
    if (pr.base !== "main") {
      throw new Error("PR base must be main");
    }
    if (!testsPassing) {
      throw new Error("Tests must pass before PR is ready");
    }
  }

  validateReleaseReadiness(openIssues: Issue[]): void {
    if (openIssues.length > 0) {
      throw new Error("All sprint issues must be closed");
    }
  }
}
