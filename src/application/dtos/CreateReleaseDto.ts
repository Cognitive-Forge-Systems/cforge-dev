import { ProjectContext } from "../../domain/models/ProjectContext";

export interface CreateReleaseDto {
  milestoneId: number;
  version: string;
  context: ProjectContext;
}
