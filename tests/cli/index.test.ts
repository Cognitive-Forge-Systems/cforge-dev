// Mock @octokit/rest which uses ESM and cannot be loaded by ts-jest directly
jest.mock("@octokit/rest", () => ({ Octokit: jest.fn() }));
jest.mock("../../src/infrastructure/github/OctokitGitHubClient");
jest.mock("../../src/infrastructure/cforge/CForgePromptGenerator");
jest.mock("../../src/infrastructure/claude/ClaudeCodeRunner");
jest.mock("../../src/infrastructure/filesystem/ContractLoader");

import { main, USAGE } from "../../src/cli/index";

describe("global --help", () => {
  let originalArgv: string[];
  let mockExit: jest.SpyInstance;
  let mockLog: jest.SpyInstance;
  let mockError: jest.SpyInstance;

  beforeEach(() => {
    originalArgv = process.argv;
    mockExit = jest.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    mockLog = jest.spyOn(console, "log").mockImplementation(() => {});
    mockError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    mockExit.mockRestore();
    mockLog.mockRestore();
    mockError.mockRestore();
  });

  it("displays global usage and exits with code 0 when --help flag is provided", async () => {
    process.argv = ["node", "cforge-dev", "--help"];
    await expect(main()).rejects.toThrow("process.exit:0");
    expect(mockLog).toHaveBeenCalledWith(USAGE);
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("lists all available commands in global help output", async () => {
    process.argv = ["node", "cforge-dev", "--help"];
    await expect(main()).rejects.toThrow("process.exit:0");
    const logOutput = mockLog.mock.calls.map((call: unknown[]) => call[0]).join("");
    expect(logOutput).toContain("plan");
    expect(logOutput).toContain("implement");
    expect(logOutput).toContain("verify");
    expect(logOutput).toContain("release");
    expect(logOutput).toContain("audit");
  });

  it("does not exit with error code when --help is used", async () => {
    process.argv = ["node", "cforge-dev", "--help"];
    await expect(main()).rejects.toThrow("process.exit:0");
    expect(mockExit).not.toHaveBeenCalledWith(1);
  });
});
