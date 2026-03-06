import { GitHubClient } from "../../domain/interfaces/GitHubClient";
import { Issue, IssueType } from "../../domain/models/Issue";
import { SDLCDoctrine } from "../../domain/engines/SDLCDoctrine";
import { CreateReleaseDto } from "../dtos/CreateReleaseDto";

export interface CreateReleaseResult {
  version: string;
  tag: string;
  changelog: string;
  releasedAt: Date;
}

const CHANGELOG_GROUPS: { type: IssueType; heading: string }[] = [
  { type: IssueType.FEATURE, heading: "## Features" },
  { type: IssueType.BUG, heading: "## Bug Fixes" },
  { type: IssueType.TASK, heading: "## Tasks" },
  { type: IssueType.ARCHITECTURE, heading: "## Architecture" },
];

export class CreateRelease {
  private readonly github: GitHubClient;
  private readonly doctrine: SDLCDoctrine;

  constructor(github: GitHubClient) {
    this.github = github;
    this.doctrine = new SDLCDoctrine();
  }

  async execute(input: CreateReleaseDto): Promise<CreateReleaseResult> {
    const openIssues = await this.github.listIssues(input.milestoneId);
    this.doctrine.validateReleaseReadiness(openIssues);

    const closedIssues = await this.github.listIssues(input.milestoneId);
    const changelog = this.buildChangelog(closedIssues);
    const tag = `v${input.version}`;

    await this.github.createRelease(tag, tag, changelog);

    return {
      version: input.version,
      tag,
      changelog,
      releasedAt: new Date(),
    };
  }

  private buildChangelog(issues: Issue[]): string {
    const sections: string[] = [];

    for (const group of CHANGELOG_GROUPS) {
      const matching = issues
        .filter((i) => i.type === group.type)
        .sort((a, b) => a.title.localeCompare(b.title));

      if (matching.length > 0) {
        const lines = matching.map((i) => `- ${i.title} (#${i.number})`);
        sections.push(`${group.heading}\n${lines.join("\n")}`);
      }
    }

    return sections.join("\n\n");
  }
}
