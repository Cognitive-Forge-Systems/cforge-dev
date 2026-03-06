import { Issue } from "./Issue";

export interface Milestone {
  id: number;
  title: string;
  description: string;
  dueDate?: string;
  issues: Issue[];
}
