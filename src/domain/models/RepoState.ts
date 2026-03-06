import { Issue } from "./Issue";
import { Milestone } from "./Milestone";
import { PullRequest } from "./PullRequest";

export interface RepoState {
  openIssues: Issue[];
  openPullRequests: PullRequest[];
  activeMilestone: Milestone | null;
  recentReleases: string[];
}
