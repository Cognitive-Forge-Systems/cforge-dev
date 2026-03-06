export interface RunOptions {
  model?: string;
  maxBudgetUsd?: number;
  allowedTools?: string[];
  branch?: string;
}

export interface RunResult {
  success: boolean;
  output: string;
  cost: number;
  turns: number;
  stopReason: string;
}

export interface CodeRunner {
  run(prompt: string, workingDir: string, options: RunOptions): Promise<RunResult>;
}
