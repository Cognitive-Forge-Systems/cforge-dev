import { ClaudeCodeRunner } from "../../src/infrastructure/claude/ClaudeCodeRunner";
import { EventEmitter } from "events";
import { PassThrough } from "stream";

jest.mock("child_process", () => ({
  execSync: jest.fn(),
  spawn: jest.fn(),
}));

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true),
  };
});

const { execSync, spawn } = require("child_process");

function mockSpawnSuccess(jsonResponse: string) {
  (spawn as jest.Mock).mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      stdin: new PassThrough(),
    });
    process.nextTick(() => {
      child.stdout.push(jsonResponse);
      child.stdout.push(null);
      child.emit("close", 0);
    });
    return child;
  });
  // `which claude` check
  (execSync as jest.Mock).mockReturnValue("/usr/bin/claude");
}

function mockSpawnFailure(code: number, stderr: string) {
  (spawn as jest.Mock).mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      stdin: new PassThrough(),
    });
    process.nextTick(() => {
      child.stderr.push(stderr);
      child.stderr.push(null);
      child.stdout.push(null);
      child.emit("close", code);
    });
    return child;
  });
  (execSync as jest.Mock).mockReturnValue("/usr/bin/claude");
}

const successJson = JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: false,
  result: "Implementation complete",
  total_cost_usd: 0.05,
  num_turns: 3,
  stop_reason: "end_turn",
});

describe("ClaudeCodeRunner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Bug-proving tests (TDD red phase) ────────────────────────────

  it("should NOT override env (no CLAUDECODE= prefix)", async () => {
    mockSpawnSuccess(successJson);
    const runner = new ClaudeCodeRunner();
    await runner.run("prompt", "/tmp/test", {});

    const spawnCall = (spawn as jest.Mock).mock.calls[0];
    const spawnOpts = spawnCall[2];
    // env must not be explicitly set — child inherits parent env naturally
    expect(spawnOpts.env).toBeUndefined();
  });

  it("should use async spawn instead of execSync for claude invocation", async () => {
    mockSpawnSuccess(successJson);
    const runner = new ClaudeCodeRunner();
    await runner.run("prompt", "/tmp/test", {});

    // spawn must be called for the claude command
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith(
      "claude",
      expect.any(Array),
      expect.any(Object)
    );

    // execSync should only be called once (for `which claude`)
    expect(execSync).toHaveBeenCalledTimes(1);
    expect(execSync).toHaveBeenCalledWith(
      "which claude",
      expect.objectContaining({ encoding: "utf-8" })
    );
  });

  it("should pass --allowed-tools as a single comma-separated value without quotes", async () => {
    mockSpawnSuccess(successJson);
    const runner = new ClaudeCodeRunner();
    await runner.run("prompt", "/tmp/test", {
      allowedTools: ["Bash", "Edit", "Read"],
    });

    const args: string[] = (spawn as jest.Mock).mock.calls[0][1];
    const toolsIdx = args.indexOf("--allowed-tools");
    expect(toolsIdx).toBeGreaterThan(-1);
    const toolsValue = args[toolsIdx + 1];
    // Must be plain comma-separated, no shell quotes
    expect(toolsValue).toBe("Bash,Edit,Read");
  });

  it("should not have a hardcoded timeout", async () => {
    mockSpawnSuccess(successJson);
    const runner = new ClaudeCodeRunner();
    await runner.run("prompt", "/tmp/test", {});

    const spawnOpts = (spawn as jest.Mock).mock.calls[0][2];
    expect(spawnOpts.timeout).toBeUndefined();
  });

  // ── Existing behaviour (green phase) ─────────────────────────────

  it("should return RunResult with cost and turns on successful run", async () => {
    mockSpawnSuccess(successJson);
    const runner = new ClaudeCodeRunner();
    const result = await runner.run("implement this", "/tmp/test", {});

    expect(result.success).toBe(true);
    expect(result.cost).toBe(0.05);
    expect(result.turns).toBe(3);
    expect(result.output).toBe("Implementation complete");
  });

  it("should send prompt via stdin", async () => {
    let capturedStdin = "";
    (spawn as jest.Mock).mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        stdin: new PassThrough(),
      });
      child.stdin.on("data", (chunk: Buffer) => {
        capturedStdin += chunk.toString();
      });
      process.nextTick(() => {
        child.stdout.push(successJson);
        child.stdout.push(null);
        child.emit("close", 0);
      });
      return child;
    });
    (execSync as jest.Mock).mockReturnValue("/usr/bin/claude");

    const runner = new ClaudeCodeRunner();
    await runner.run("test prompt content", "/tmp/test", {});

    expect(capturedStdin).toBe("test prompt content");
  });

  it("should throw descriptive error when claude CLI not found", async () => {
    (execSync as jest.Mock).mockImplementation(() => {
      throw new Error("command not found");
    });

    const runner = new ClaudeCodeRunner();
    await expect(runner.run("prompt", "/tmp/test", {})).rejects.toThrow(
      "claude CLI not found — install Claude Code first"
    );
  });

  it("should throw descriptive error on JSON parse failure", async () => {
    (spawn as jest.Mock).mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        stdin: new PassThrough(),
      });
      process.nextTick(() => {
        child.stdout.push("not valid json at all");
        child.stdout.push(null);
        child.emit("close", 0);
      });
      return child;
    });
    (execSync as jest.Mock).mockReturnValue("/usr/bin/claude");

    const runner = new ClaudeCodeRunner();
    await expect(runner.run("prompt", "/tmp/test", {})).rejects.toThrow(
      "Failed to parse claude output"
    );
  });

  it("should throw on non-zero exit code", async () => {
    mockSpawnFailure(1, "something went wrong");
    const runner = new ClaudeCodeRunner();

    await expect(runner.run("prompt", "/tmp/test", {})).rejects.toThrow(
      "claude exited with code 1"
    );
  });

  it("should throw on spawn error", async () => {
    (spawn as jest.Mock).mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        stdin: new PassThrough(),
      });
      process.nextTick(() => {
        child.emit("error", new Error("spawn ENOENT"));
      });
      return child;
    });
    (execSync as jest.Mock).mockReturnValue("/usr/bin/claude");

    const runner = new ClaudeCodeRunner();
    await expect(runner.run("prompt", "/tmp/test", {})).rejects.toThrow(
      "spawn ENOENT"
    );
  });

  it("should pass correct default flags with env-based budget", async () => {
    mockSpawnSuccess(successJson);
    const runner = new ClaudeCodeRunner();
    await runner.run("prompt", "/tmp/work", {});

    const [bin, args, opts] = (spawn as jest.Mock).mock.calls[0];
    expect(bin).toBe("claude");
    expect(args).toEqual([
      "--print",
      "--model", "claude-sonnet-4-6",
      "--dangerously-skip-permissions",
      "--allowed-tools", "Bash,Edit,Read,Write,Glob,Grep",
      "--max-budget-usd", "5",
      "--output-format", "json",
    ]);
    expect(opts.cwd).toBe("/tmp/work");
  });

  it("should read CFORGE_MAX_BUDGET from env with default of 5", async () => {
    mockSpawnSuccess(successJson);
    const original = process.env.CFORGE_MAX_BUDGET;
    try {
      delete process.env.CFORGE_MAX_BUDGET;
      const runner = new ClaudeCodeRunner();
      await runner.run("prompt", "/tmp/test", {});

      const args: string[] = (spawn as jest.Mock).mock.calls[0][1];
      const idx = args.indexOf("--max-budget-usd");
      expect(args[idx + 1]).toBe("5");
    } finally {
      if (original !== undefined) process.env.CFORGE_MAX_BUDGET = original;
    }
  });

  it("should use CFORGE_MAX_BUDGET env var when set", async () => {
    mockSpawnSuccess(successJson);
    const original = process.env.CFORGE_MAX_BUDGET;
    try {
      process.env.CFORGE_MAX_BUDGET = "10";
      const runner = new ClaudeCodeRunner();
      await runner.run("prompt", "/tmp/test", {});

      const args: string[] = (spawn as jest.Mock).mock.calls[0][1];
      const idx = args.indexOf("--max-budget-usd");
      expect(args[idx + 1]).toBe("10");
    } finally {
      if (original !== undefined) {
        process.env.CFORGE_MAX_BUDGET = original;
      } else {
        delete process.env.CFORGE_MAX_BUDGET;
      }
    }
  });

  it("should let RunOptions.maxBudgetUsd override env var", async () => {
    mockSpawnSuccess(successJson);
    const original = process.env.CFORGE_MAX_BUDGET;
    try {
      process.env.CFORGE_MAX_BUDGET = "10";
      const runner = new ClaudeCodeRunner();
      await runner.run("prompt", "/tmp/test", { maxBudgetUsd: 20 });

      const args: string[] = (spawn as jest.Mock).mock.calls[0][1];
      const idx = args.indexOf("--max-budget-usd");
      expect(args[idx + 1]).toBe("20");
    } finally {
      if (original !== undefined) {
        process.env.CFORGE_MAX_BUDGET = original;
      } else {
        delete process.env.CFORGE_MAX_BUDGET;
      }
    }
  });

  it("should respect custom model and budget options", async () => {
    mockSpawnSuccess(successJson);
    const runner = new ClaudeCodeRunner();
    await runner.run("prompt", "/tmp/test", {
      model: "claude-opus-4-6",
      maxBudgetUsd: 5.0,
    });

    const args: string[] = (spawn as jest.Mock).mock.calls[0][1];
    expect(args).toContain("claude-opus-4-6");
    expect(args).toContain("5");
  });
});
