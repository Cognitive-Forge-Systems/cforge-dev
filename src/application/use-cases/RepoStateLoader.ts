import { GitHubClient } from "../../domain/interfaces/GitHubClient";
import { RepoState } from "../../domain/models/RepoState";

export class RepoStateLoader {
  private readonly github: GitHubClient;

  constructor(github: GitHubClient) {
    this.github = github;
  }

  async execute(): Promise<RepoState> {
    const [openIssues, openPullRequests] = await Promise.all([
      this.github.listIssues(),
      this.github.listOpenPullRequests(),
    ]);

    return {
      openIssues,
      openPullRequests,
      activeMilestone: null,
      recentReleases: [],
    };
  }
}
