export interface ProjectContext {
  repoOwner: string;
  repoName: string;
  stack: string;
  architecture: string;
  rules: string[];
  existingModules: { name: string; description: string }[];
  openQuestions: string[];
}
