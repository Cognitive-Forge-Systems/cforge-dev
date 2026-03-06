export interface PullRequest {
  number: number;
  title: string;
  branch: string;
  base: string;
  status: "open" | "closed" | "merged";
  checksPassing: boolean;
  body?: string;
}
