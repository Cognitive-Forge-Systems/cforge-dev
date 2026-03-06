import { GitHubClient } from "../../domain/interfaces/GitHubClient";
import { PromptGenerator } from "../../domain/interfaces/PromptGenerator";
import { Issue, IssueType } from "../../domain/models/Issue";
import { PullRequest } from "../../domain/models/PullRequest";
import { SDLCDoctrine } from "../../domain/engines/SDLCDoctrine";
import { VerifyIssueDto } from "../dtos/VerifyIssueDto";

const BRANCH_PREFIX: Partial<Record<IssueType, string>> = {
  [IssueType.FEATURE]: "feat/",
  [IssueType.BUG]: "fix/",
  [IssueType.TASK]: "chore/",
  [IssueType.ARCHITECTURE]: "feat/",
};

export interface VerifyIssueResult {
  issue: Issue;
  pr: PullRequest | null;
  ready: boolean;
  critique: string;
  blockers: string[];
  nextSteps: string[];
}

export class VerifyIssue {
  private readonly github: GitHubClient;
  private readonly promptGen: PromptGenerator;
  private readonly doctrine: SDLCDoctrine;

  constructor(github: GitHubClient, promptGen: PromptGenerator) {
    this.github = github;
    this.promptGen = promptGen;
    this.doctrine = new SDLCDoctrine();
  }

  async execute(input: VerifyIssueDto): Promise<VerifyIssueResult> {
    const issue = await this.github.getIssue(input.issueNumber);
    const openPRs = await this.github.listOpenPullRequests();

    const pr = this.matchPR(issue, openPRs);

    const blockers: string[] = [];

    if (!pr) {
      blockers.push("No open PR found for this issue");
    } else {
      if (pr.base !== "main") {
        blockers.push("PR must target main branch");
      }
      if (!pr.checksPassing) {
        blockers.push("All checks must pass before merge");
      }
    }

    const ready = blockers.length === 0;

    // Always run critique
    const critique = await this.promptGen.generateImplementationPrompt(issue, input.context);

    let nextSteps: string[];
    if (ready && pr) {
      nextSteps = [
        "Review the PR on GitHub",
        `Merge when approved: gh pr merge ${pr.number} --squash`,
        "Run: cforge-dev release when sprint is complete",
      ];
    } else {
      nextSteps = blockers.map((b) => `Fix: ${b}`);
    }

    return { issue, pr, ready, critique, blockers, nextSteps };
  }

  private matchPR(issue: Issue, prs: PullRequest[]): PullRequest | null {
    // Strategy 1: exact match on issue.branch if set
    if (issue.branch) {
      const match = prs.find((p) => p.branch === issue.branch);
      if (match) return match;
    }

    // Strategy 2: match by computed branch name based on issue type and title
    const expectedBranch = this.buildExpectedBranchName(issue);
    if (expectedBranch) {
      const match = prs.find((p) => p.branch === expectedBranch);
      if (match) return match;
    }

    // Strategy 3: fallback — issue number anywhere in branch name
    const byNumber = prs.find((p) => p.branch.includes(String(issue.number)));
    if (byNumber) return byNumber;

    // Strategy 4: issue number referenced in PR body (e.g. "Closes #42")
    const byBody = prs.find((p) => p.body?.includes(`#${issue.number}`));
    if (byBody) return byBody;

    return null;
  }

  private buildExpectedBranchName(issue: Issue): string {
    if (issue.type === IssueType.ARCHITECTURE) {
      return `feat/architecture-${issue.number}`;
    }

    const prefix = BRANCH_PREFIX[issue.type];
    if (!prefix) return "";

    const slug = issue.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return `${prefix}${slug}`;
  }
}
