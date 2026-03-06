import { Issue } from "../models/Issue";
import { ProjectContext } from "../models/ProjectContext";

export interface PromptGenerator {
  generateImplementationPrompt(issue: Issue, context: ProjectContext): Promise<string>;
  generatePlanningPrompt(prd: string, context: ProjectContext): Promise<string>;
}
