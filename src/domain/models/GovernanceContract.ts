import { GovernanceRule } from "./GovernanceRule";

export interface GovernanceContract {
  id: string;
  title: string;
  rules: GovernanceRule[];
}
