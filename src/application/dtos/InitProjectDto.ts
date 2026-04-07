export interface IdeaAnswers {
  problem: string;
  audience: string;
  differentiator: string;
}

export interface InitProjectDto {
  /** GitHub owner (org or user). Resolved from git remote when available. */
  repoOwner?: string;
  /** GitHub repository name. Resolved from git remote when available. */
  repoName?: string;
  /** Answers from interactive IDEA.md prompts; omit to skip IDEA.md generation. */
  ideaAnswers?: IdeaAnswers;
  /** Whether to scaffold docs/decisions/ and docs/scenarios/. */
  scaffoldDocs: boolean;
}
