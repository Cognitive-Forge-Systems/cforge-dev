import { Issue } from "../models/Issue";
import { Milestone } from "../models/Milestone";
import { PullRequest } from "../models/PullRequest";

export interface GitHubClient {
  createMilestone(title: string, description: string): Promise<Milestone>;
  createIssue(title: string, body: string, type: string, milestoneId: number): Promise<Issue>;
  getIssue(number: number): Promise<Issue>;
  listIssues(milestoneId?: number): Promise<Issue[]>;
  createBranch(name: string, fromBranch: string): Promise<void>;
  createPullRequest(title: string, body: string, branch: string, base: string): Promise<PullRequest>;
  getPullRequest(number: number): Promise<PullRequest>;
  listOpenPullRequests(): Promise<PullRequest[]>;
  closeIssue(number: number): Promise<void>;
  createRelease(tag: string, title: string, notes: string): Promise<void>;
}
