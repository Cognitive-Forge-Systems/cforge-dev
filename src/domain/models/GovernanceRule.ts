export interface GovernanceRule {
  id: string;
  description: string;
  severity: "error" | "warning";
  check: "file-exists" | "file-contains" | "commit-format" | "branch-format";
  target?: string;
  pattern?: string;
}
