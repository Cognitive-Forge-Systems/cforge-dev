import { GitHubClient } from "../../domain/interfaces/GitHubClient";
import { PromptGenerator } from "../../domain/interfaces/PromptGenerator";
import { BranchConflictResolver } from "../../domain/interfaces/BranchConflictResolver";
import { Issue, IssueType } from "../../domain/models/Issue";
import { ProjectContext } from "../../domain/models/ProjectContext";
import { SDLCDoctrine } from "../../domain/engines/SDLCDoctrine";
import { ImplementIssueDto } from "../dtos/ImplementIssueDto";

const BRANCH_PREFIX: Record<IssueType, string> = {
  [IssueType.FEATURE]: "feat/",
  [IssueType.BUG]: "fix/",
  [IssueType.TASK]: "chore/",
  [IssueType.ARCHITECTURE]: "feat/",
  [IssueType.PRD]: "",
};

export interface ImplementIssueResult {
  issue: Issue;
  branch: string;
  prompt: string;
  nextSteps: string[];
}

export class ImplementIssue {
  private readonly github: GitHubClient;
  private readonly promptGen: PromptGenerator;
  private readonly doctrine: SDLCDoctrine;
  private readonly branchConflictResolver?: BranchConflictResolver;

  constructor(github: GitHubClient, promptGen: PromptGenerator, branchConflictResolver?: BranchConflictResolver) {
    this.github = github;
    this.promptGen = promptGen;
    this.doctrine = new SDLCDoctrine();
    this.branchConflictResolver = branchConflictResolver;
  }

  async execute(input: ImplementIssueDto): Promise<ImplementIssueResult> {
    const issue = await this.github.getIssue(input.issueNumber);

    this.doctrine.validateIssueForImplementation(issue);

    const branch = this.buildBranchName(issue);
    this.doctrine.validateBranchName(branch, issue);

    const exists = await this.github.branchExists(branch);
    if (exists) {
      if (!this.branchConflictResolver) {
        throw new Error(
          `Branch '${branch}' already exists on remote. Delete it manually or retry with a conflict resolver.`
        );
      }
      const action = await this.branchConflictResolver.resolve(branch);
      if (action === "abort") {
        throw new Error("Aborted: branch already exists, no changes made.");
      }
      if (action === "reset") {
        await this.github.deleteBranch(branch);
        await this.github.createBranch(branch, "main");
      }
      // "continue": use existing branch as-is
    } else {
      await this.github.createBranch(branch, "main");
    }

    const prompt = await this.promptGen.generateImplementationPrompt(issue, input.context);

    const nextSteps = [
      "Open Claude Code in the project directory",
      `Switch to branch: ${branch}`,
      "Paste the generated prompt",
      "Run tests after implementation: npm test",
      `Open PR when tests pass: cforge-dev verify ${issue.number}`,
    ];

    return { issue, branch, prompt, nextSteps };
  }

  private buildBranchName(issue: Issue): string {
    if (issue.type === IssueType.ARCHITECTURE) {
      return `feat/architecture-${issue.number}`;
    }

    const prefix = BRANCH_PREFIX[issue.type];
    const slug = issue.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return `${prefix}${slug}`;
  }
}
