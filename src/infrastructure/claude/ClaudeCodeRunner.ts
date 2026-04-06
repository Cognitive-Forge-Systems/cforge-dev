import { execSync, spawn } from "child_process";
import { CodeRunner, RunOptions, RunResult } from "../../domain/interfaces/CodeRunner";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_BUDGET = 5;
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
    const envBudget = process.env.CFORGE_MAX_BUDGET ? Number(process.env.CFORGE_MAX_BUDGET) : DEFAULT_BUDGET;
    const budget = options.maxBudgetUsd ?? envBudget;
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

    const { stdout, stderr, exitCode } = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve, reject) => {
      const child = spawn("claude", args, {
        cwd: workingDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdoutBuf = "";
      let stderrBuf = "";

      child.stdout.on("data", (data: Buffer) => {
        stdoutBuf += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderrBuf += data.toString();
      });

      child.stdin.write(prompt);
      child.stdin.end();

      child.on("close", (code: number | null) => {
        resolve({ stdout: stdoutBuf, stderr: stderrBuf, exitCode: code });
      });

      child.on("error", (err: Error) => {
        reject(err);
      });
    });

    // Try to parse JSON from stdout — even on non-zero exit (e.g. budget exhaustion)
    let parsed: ClaudeJsonResponse;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch {
      if (exitCode !== 0) {
        throw new Error(`claude exited with code ${exitCode}: ${stderr}`);
      }
      throw new Error(`Failed to parse claude output: ${stdout.slice(0, 200)}`);
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
