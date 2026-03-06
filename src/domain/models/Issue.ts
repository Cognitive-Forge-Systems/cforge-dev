export enum IssueType {
  PRD = "PRD",
  ARCHITECTURE = "ARCHITECTURE",
  FEATURE = "FEATURE",
  TASK = "TASK",
  BUG = "BUG",
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  type: IssueType;
  milestoneId?: number;
  branch?: string;
}
