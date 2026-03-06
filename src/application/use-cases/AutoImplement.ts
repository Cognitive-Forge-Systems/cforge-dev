import { execSync } from "child_process";
import { GitHubClient } from "../../domain/interfaces/GitHubClient";
import { PromptGenerator } from "../../domain/interfaces/PromptGenerator";
import { CodeRunner } from "../../domain/interfaces/CodeRunner";
import { Issue, IssueType } from "../../domain/models/Issue";
import { ProjectContext } from "../../domain/models/ProjectContext";
import { AutoImplementResult } from "../../domain/models/AutoImplementResult";
import { SDLCDoctrine } from "../../domain/engines/SDLCDoctrine";

const BRANCH_PREFIX: Record<IssueType, string> = {
  [IssueType.FEATURE]: "feat/",
  [IssueType.BUG]: "fix/",
  [IssueType.TASK]: "chore/",
  [IssueType.ARCHITECTURE]: "feat/",
  [IssueType.PRD]: "",
};

export interface AutoImplementInput {
  issueNumber: number;
  context: ProjectContext;
  maxBudgetUsd?: number;
  model?: string;
}

export class AutoImplement {
  private readonly github: GitHubClient;
  private readonly promptGen: PromptGenerator;
  private readonly codeRunner: CodeRunner;
  private readonly testRunner: (dir: string) => Promise<{ passed: boolean; output: string }>;
  private readonly doctrine: SDLCDoctrine;

  constructor(
    github: GitHubClient,
    promptGen: PromptGenerator,
    codeRunner: CodeRunner,
    testRunner: (dir: string) => Promise<{ passed: boolean; output: string }>,
  ) {
    this.github = github;
    this.promptGen = promptGen;
    this.codeRunner = codeRunner;
    this.testRunner = testRunner;
    this.doctrine = new SDLCDoctrine();
  }

  async execute(input: AutoImplementInput): Promise<AutoImplementResult> {
    // Step 1: Fetch issue and validate
    const issue = await this.github.getIssue(input.issueNumber);
    this.doctrine.validateIssueForImplementation(issue);

    // Step 2: Generate branch name, create branch
    const branch = this.buildBranchName(issue);
    this.doctrine.validateBranchName(branch, issue);
    await this.github.createBranch(branch, "main");

    // Step 3: Generate implementation prompt
    const basePrompt = await this.promptGen.generateImplementationPrompt(issue, input.context);
    const fullPrompt = `${basePrompt}

IMPORTANT — before making any changes:
1. Run: git checkout ${branch}

After implementing:
1. Run: npm test
2. If tests pass: git add -A && git commit -m 'feat: ${issue.title}'
3. If tests fail: fix them before committing
4. Do not open a PR — cforge-dev will handle that`;

    // Step 4: Run Claude Code
    const workingDir = process.cwd();
    let runResult = await this.codeRunner.run(fullPrompt, workingDir, {
      model: input.model,
      maxBudgetUsd: input.maxBudgetUsd,
      branch,
    });

    if (!runResult.success) {
      return this.buildResult(issue, branch, runResult, false, false, false);
    }

    // Step 5: Run tests
    let testResult = await this.testRunner(workingDir);
    let retried = false;

    // Step 6: If tests fail → retry once
    if (!testResult.passed) {
      retried = true;
      const retryPrompt = `${fullPrompt}

The previous implementation attempt failed tests. Here is the test output:

${testResult.output}

Fix the failing tests and ensure all tests pass before committing.`;

      runResult = await this.codeRunner.run(retryPrompt, workingDir, {
        model: input.model,
        maxBudgetUsd: input.maxBudgetUsd,
        branch,
      });

      testResult = await this.testRunner(workingDir);
    }

    if (!testResult.passed) {
      return this.buildResult(issue, branch, runResult, false, false, retried);
    }

    // Step 7: Push branch and open PR
    execSync(`git push origin ${branch}`, { cwd: workingDir, encoding: "utf-8", stdio: "pipe" });
    const prBody = this.buildPRBody(issue, runResult.output, runResult.cost, runResult.turns);
    const pr = await this.github.createPullRequest(
      `feat: ${issue.title}`,
      prBody,
      branch,
      "main",
    );

    const result = this.buildResult(issue, branch, runResult, true, true, retried);
    result.prNumber = pr.number;
    result.prUrl = `https://github.com/${input.context.repoOwner}/${input.context.repoName}/pull/${pr.number}`;
    return result;
  }

  private buildResult(
    issue: Issue,
    branch: string,
    runResult: { output: string; cost: number; turns: number },
    success: boolean,
    testsPassed: boolean,
    retried: boolean,
  ): AutoImplementResult {
    const manualStepsRequired: string[] = [];
    if (!success) {
      manualStepsRequired.push(
        `cd to branch: git checkout ${branch}`,
        "Review test output: npm test",
        "Fix failing tests manually",
        `Push and open PR manually: cforge-dev verify ${issue.number}`,
      );
    }

    return {
      issue,
      branch,
      success,
      testsPassed,
      cost: runResult.cost,
      turns: runResult.turns,
      claudeOutput: runResult.output,
      retried,
      error: success ? undefined : "Tests failed after implementation",
      manualStepsRequired,
    };
  }

  private buildPRBody(issue: Issue, claudeOutput: string, cost: number, turns: number): string {
    const summary = claudeOutput.slice(0, 500);
    return `## Summary
Automated implementation via cforge-dev --auto

${issue.title}

## Issue
Closes #${issue.number}

## Implementation
${summary}

## Cost
Claude session cost: $${cost.toFixed(4)} (${turns} turns)`;
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
