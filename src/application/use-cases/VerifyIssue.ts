import { GitHubClient } from "../../domain/interfaces/GitHubClient";
import { PromptGenerator } from "../../domain/interfaces/PromptGenerator";
import { Issue } from "../../domain/models/Issue";
import { PullRequest } from "../../domain/models/PullRequest";
import { SDLCDoctrine } from "../../domain/engines/SDLCDoctrine";
import { VerifyIssueDto } from "../dtos/VerifyIssueDto";

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

    const pr = openPRs.find((p) => issue.branch && p.branch === issue.branch) ?? null;

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
}
