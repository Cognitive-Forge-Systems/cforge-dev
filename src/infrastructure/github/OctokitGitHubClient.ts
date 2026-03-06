import { execSync } from "child_process";
import { Octokit } from "@octokit/rest";
import { GitHubClient } from "../../domain/interfaces/GitHubClient";
import { Issue, IssueType } from "../../domain/models/Issue";
import { Milestone } from "../../domain/models/Milestone";
import { PullRequest } from "../../domain/models/PullRequest";

const ISSUE_TYPE_TO_LABEL: Record<IssueType, string> = {
  [IssueType.PRD]: "prd",
  [IssueType.ARCHITECTURE]: "architecture",
  [IssueType.FEATURE]: "feature",
  [IssueType.TASK]: "task",
  [IssueType.BUG]: "bug",
};

const LABEL_TO_ISSUE_TYPE: Record<string, IssueType> = Object.fromEntries(
  Object.entries(ISSUE_TYPE_TO_LABEL).map(([k, v]) => [v, k as IssueType])
);

export class OctokitGitHubClient implements GitHubClient {
  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;

  constructor(owner: string, repo: string) {
    const token = process.env.GITHUB_TOKEN || this.getGhToken();
    if (!token) {
      throw new Error("GITHUB_TOKEN not set and gh auth token unavailable");
    }
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  async createMilestone(title: string, description: string): Promise<Milestone> {
    const { data } = await this.octokit.issues.createMilestone({
      owner: this.owner,
      repo: this.repo,
      title,
      description,
    });
    return {
      id: data.number,
      title: data.title,
      description: data.description ?? "",
      dueDate: data.due_on ?? undefined,
      issues: [],
    };
  }

  async createIssue(title: string, body: string, type: IssueType, milestoneId: number): Promise<Issue> {
    const { data } = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      labels: [ISSUE_TYPE_TO_LABEL[type]],
      milestone: milestoneId,
    });
    return this.mapIssue(data);
  }

  async getIssue(number: number): Promise<Issue> {
    const { data } = await this.octokit.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: number,
    });
    return this.mapIssue(data);
  }

  async listIssues(milestoneId?: number): Promise<Issue[]> {
    const { data } = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      milestone: milestoneId as unknown as string,
      state: "all",
    });
    return data.map((d) => this.mapIssue(d));
  }

  async createBranch(name: string, fromBranch: string): Promise<void> {
    const { data: ref } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${fromBranch}`,
    });
    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${name}`,
      sha: ref.object.sha,
    });
  }

  async createPullRequest(title: string, body: string, branch: string, base: string): Promise<PullRequest> {
    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head: branch,
      base,
    });
    return this.mapPR(data);
  }

  async getPullRequest(number: number): Promise<PullRequest> {
    const { data } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: number,
    });
    return this.mapPR(data);
  }

  async listOpenPullRequests(): Promise<PullRequest[]> {
    const { data } = await this.octokit.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: "open",
    });
    return data.map((d) => this.mapPR(d));
  }

  async closeIssue(number: number): Promise<void> {
    await this.octokit.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: number,
      state: "closed",
    });
  }

  async createRelease(tag: string, title: string, notes: string): Promise<void> {
    await this.octokit.repos.createRelease({
      owner: this.owner,
      repo: this.repo,
      tag_name: tag,
      name: title,
      body: notes,
      generate_release_notes: false,
    });
  }

  private mapIssue(data: Record<string, unknown>): Issue {
    const labels = (data.labels as { name?: string }[]) ?? [];
    const labelName = labels.find((l) => l.name && l.name in LABEL_TO_ISSUE_TYPE)?.name;
    const type = labelName ? LABEL_TO_ISSUE_TYPE[labelName] : IssueType.TASK;
    const milestone = data.milestone as { number?: number } | null;

    return {
      id: data.id as number,
      number: data.number as number,
      title: data.title as string,
      body: (data.body as string) ?? "",
      type,
      milestoneId: milestone?.number,
      branch: undefined,
    };
  }

  private getGhToken(): string | undefined {
    try {
      return execSync("gh auth token", { encoding: "utf-8" }).trim();
    } catch {
      return undefined;
    }
  }

  private mapPR(data: Record<string, unknown>): PullRequest {
    const head = data.head as { ref: string };
    const base = data.base as { ref: string };
    const state = data.state as string;
    const mergeableState = data.mergeable_state as string | undefined;

    let status: "open" | "closed" | "merged";
    if ((data.merged as boolean) === true) {
      status = "merged";
    } else if (state === "closed") {
      status = "closed";
    } else {
      status = "open";
    }

    return {
      number: data.number as number,
      title: data.title as string,
      branch: head.ref,
      base: base.ref,
      status,
      checksPassing: mergeableState === "clean",
    };
  }
}
