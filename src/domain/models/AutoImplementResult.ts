import { Issue } from "./Issue";

export interface AutoImplementResult {
  issue: Issue;
  branch: string;
  success: boolean;
  testsPassed: boolean;
  prNumber?: number;
  prUrl?: string;
  cost: number;
  turns: number;
  claudeOutput: string;
  stopReason?: string;
  retried: boolean;
  error?: string;
  manualStepsRequired: string[];
}
