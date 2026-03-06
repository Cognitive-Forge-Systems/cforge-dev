import { ProjectContext } from "../../domain/models/ProjectContext";

export interface ImplementIssueDto {
  issueNumber: number;
  context: ProjectContext;
  model?: string;
}
