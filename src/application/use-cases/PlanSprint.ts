import { GitHubClient } from "../../domain/interfaces/GitHubClient";
import { PromptGenerator } from "../../domain/interfaces/PromptGenerator";
import { IssueType, Issue } from "../../domain/models/Issue";
import { Sprint } from "../../domain/models/Sprint";
import { ProjectContext } from "../../domain/models/ProjectContext";
import { PlanSprintDto } from "../dtos/PlanSprintDto";

interface PlannedIssue {
  title: string;
  body: string;
  featureRef?: string;
}

interface SprintPlan {
  architectureIssues: PlannedIssue[];
  featureIssues: PlannedIssue[];
  taskIssues: PlannedIssue[];
}

export class PlanSprint {
  private readonly github: GitHubClient;
  private readonly prompt: PromptGenerator;
  private readonly context: ProjectContext;

  constructor(github: GitHubClient, prompt: PromptGenerator, context: ProjectContext) {
    this.github = github;
    this.prompt = prompt;
    this.context = context;
  }

  async execute(input: PlanSprintDto): Promise<Sprint> {
    const raw = await this.prompt.generatePlanningPrompt(input.prdContent, this.context);
    const plan = this.parsePlan(raw);

    if (plan.architectureIssues.length === 0) {
      throw new Error("PRD must produce at least one architecture issue");
    }

    const milestone = await this.github.createMilestone(
      input.milestoneTitle,
      input.milestoneDescription
    );

    const issues: Issue[] = [];

    for (const arch of plan.architectureIssues) {
      const issue = await this.github.createIssue(
        arch.title, arch.body, IssueType.ARCHITECTURE, milestone.id
      );
      issues.push(issue);
    }

    for (const feat of plan.featureIssues) {
      const issue = await this.github.createIssue(
        feat.title, feat.body, IssueType.FEATURE, milestone.id
      );
      issues.push(issue);
    }

    for (const task of plan.taskIssues) {
      const issue = await this.github.createIssue(
        task.title, task.body, IssueType.TASK, milestone.id
      );
      issues.push(issue);
    }

    return {
      milestone: { ...milestone, issues },
      issues,
      status: "active",
    };
  }

  private parsePlan(raw: string): SprintPlan {
    const stripped = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new Error("Failed to parse sprint plan: invalid JSON");
    }

    const obj = parsed as Record<string, unknown>;
    if (
      !Array.isArray(obj.architectureIssues) ||
      !Array.isArray(obj.featureIssues) ||
      !Array.isArray(obj.taskIssues)
    ) {
      throw new Error("Failed to parse sprint plan: missing required fields");
    }

    return parsed as SprintPlan;
  }
}
