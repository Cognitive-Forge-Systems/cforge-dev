import { ProjectContext } from "../../domain/models/ProjectContext";

export interface VerifyIssueDto {
  issueNumber: number;
  context: ProjectContext;
  model?: string;
}
