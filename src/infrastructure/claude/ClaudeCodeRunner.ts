import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
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

    // Write prompt to temp file
    const tmpFile = path.join(os.tmpdir(), `prompt-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, prompt);

    try {
      const toolsArg = tools.map((t) => `"${t}"`).join(",");
      const cmd = [
        "CLAUDECODE=",
        "claude",
        "--print",
        `--model ${model}`,
        "--dangerously-skip-permissions",
        `--allowedTools ${toolsArg}`,
        `--max-budget-usd ${budget}`,
        "--output-format json",
        `< "${tmpFile}"`,
      ].join(" ");

      const output = execSync(cmd, {
        cwd: workingDir,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 600000, // 10 minutes
        env: { ...process.env, CLAUDECODE: "" },
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
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
