import { execSync, spawn } from "child_process";
import { CodeRunner, RunOptions, RunResult } from "../../domain/interfaces/CodeRunner";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_BUDGET = 1.0;
const DEFAULT_TOOLS = ["Bash", "Edit", "Read", "Write", "Glob", "Grep"];

interface ClaudeJsonResponse {
  type: string;
  subtype: string;
  is_error: boolean;
  result: string;
  total_cost_usd: number;
  num_turns: number;
  stop_reason: string;
}

export class ClaudeCodeRunner implements CodeRunner {
  async run(prompt: string, workingDir: string, options: RunOptions): Promise<RunResult> {
    const model = options.model ?? DEFAULT_MODEL;
    const budget = options.maxBudgetUsd ?? DEFAULT_BUDGET;
    const tools = options.allowedTools ?? DEFAULT_TOOLS;

    // Check if claude CLI exists
    try {
      execSync("which claude", { encoding: "utf-8", stdio: "pipe" });
    } catch {
      throw new Error("claude CLI not found — install Claude Code first");
    }

    const args = [
      "--print",
      "--model", model,
      "--dangerously-skip-permissions",
      "--allowed-tools", tools.join(","),
      "--max-budget-usd", String(budget),
      "--output-format", "json",
    ];

    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn("claude", args, {
        cwd: workingDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.stdin.write(prompt);
      child.stdin.end();

      child.on("close", (code: number | null) => {
        if (code !== 0) {
          reject(new Error(`claude exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      child.on("error", (err: Error) => {
        reject(err);
      });
    });

    let parsed: ClaudeJsonResponse;
    try {
      parsed = JSON.parse(output.trim());
    } catch {
      throw new Error(`Failed to parse claude output: ${output.slice(0, 200)}`);
    }

    return {
      success: !parsed.is_error && parsed.subtype === "success",
      output: parsed.result ?? "",
      cost: parsed.total_cost_usd ?? 0,
      turns: parsed.num_turns ?? 0,
      stopReason: parsed.stop_reason ?? "unknown",
    };
  }
}
