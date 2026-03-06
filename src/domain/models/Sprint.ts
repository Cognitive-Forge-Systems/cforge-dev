import { Issue } from "./Issue";
import { Milestone } from "./Milestone";

export interface Sprint {
  milestone: Milestone;
  issues: Issue[];
  status: "planning" | "active" | "complete";
}
