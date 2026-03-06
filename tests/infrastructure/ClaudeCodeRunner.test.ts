import { ClaudeCodeRunner } from "../../src/infrastructure/claude/ClaudeCodeRunner";

jest.mock("child_process", () => ({
  execSync: jest.fn(),
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

const { execSync } = require("child_process");
const fs = require("fs");

describe("ClaudeCodeRunner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  it("should return RunResult with cost and turns on successful run", async () => {
    const jsonResponse = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: "Implementation complete",
      total_cost_usd: 0.05,
      num_turns: 3,
      stop_reason: "end_turn",
    });
    (execSync as jest.Mock).mockReturnValue(jsonResponse);

    const runner = new ClaudeCodeRunner();
    const result = await runner.run("implement this", "/tmp/test", {});

    expect(result.success).toBe(true);
    expect(result.cost).toBe(0.05);
    expect(result.turns).toBe(3);
    expect(result.output).toBe("Implementation complete");
  });

  it("should write prompt to temp file before running", async () => {
    const jsonResponse = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: "done",
      total_cost_usd: 0.01,
      num_turns: 1,
      stop_reason: "end_turn",
    });
    (execSync as jest.Mock).mockReturnValue(jsonResponse);

    const runner = new ClaudeCodeRunner();
    await runner.run("test prompt content", "/tmp/test", {});

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = (fs.writeFileSync as jest.Mock).mock.calls[0];
    expect(writtenPath).toContain("prompt-");
    expect(writtenContent).toBe("test prompt content");
  });

  it("should clean up temp file after run", async () => {
    const jsonResponse = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: "done",
      total_cost_usd: 0.01,
      num_turns: 1,
      stop_reason: "end_turn",
    });
    (execSync as jest.Mock).mockReturnValue(jsonResponse);

    const runner = new ClaudeCodeRunner();
    await runner.run("prompt", "/tmp/test", {});

    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    const [deletedPath] = (fs.unlinkSync as jest.Mock).mock.calls[0];
    expect(deletedPath).toContain("prompt-");
  });

  it("should throw descriptive error when claude CLI not found", async () => {
    (execSync as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd === "which claude") {
        throw new Error("command not found");
      }
      return "";
    });

    const runner = new ClaudeCodeRunner();

    await expect(runner.run("prompt", "/tmp/test", {})).rejects.toThrow(
      "claude CLI not found — install Claude Code first"
    );
  });

  it("should throw descriptive error on JSON parse failure", async () => {
    (execSync as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd === "which claude") return "/usr/bin/claude";
      return "not valid json at all";
    });

    const runner = new ClaudeCodeRunner();

    await expect(runner.run("prompt", "/tmp/test", {})).rejects.toThrow(
      "Failed to parse claude output"
    );
  });
});
