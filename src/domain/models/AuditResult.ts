import { GovernanceRule } from "./GovernanceRule";

export interface AuditResult {
  contractId: string;
  rule: GovernanceRule;
  passed: boolean;
  message: string;
  fix?: string;
}
