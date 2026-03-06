// Mock ESM dependencies before imports
jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

import { implementCommand } from "../../src/cli/commands/implement";
import { verifyCommand } from "../../src/cli/commands/verify";
import { releaseCommand } from "../../src/cli/commands/release";
import { planCommand } from "../../src/cli/commands/plan";

describe("CLI input validation", () => {
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, "exit").mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit(${code})`);
    });
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("implement command", () => {
    it("should print usage and exit 1 when no argument is provided", async () => {
      await expect(implementCommand(undefined as unknown as string)).rejects.toThrow("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith("Usage: cforge-dev implement <issue-number> [--auto]");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should print error and exit 1 when issue number is not numeric", async () => {
      await expect(implementCommand("abc")).rejects.toThrow("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith("Issue number must be a number");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("verify command", () => {
    it("should print usage and exit 1 when no argument is provided", async () => {
      await expect(verifyCommand(undefined as unknown as string)).rejects.toThrow("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith("Usage: cforge-dev verify <issue-number>");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should print error and exit 1 when issue number is not numeric", async () => {
      await expect(verifyCommand("xyz")).rejects.toThrow("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith("Issue number must be a number");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("release command", () => {
    it("should print usage and exit 1 when no arguments are provided", async () => {
      await expect(
        releaseCommand(undefined as unknown as string, undefined as unknown as string)
      ).rejects.toThrow("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith("Usage: cforge-dev release <milestone-id> <version>");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should print usage and exit 1 when version is missing", async () => {
      await expect(
        releaseCommand("1", undefined as unknown as string)
      ).rejects.toThrow("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith("Usage: cforge-dev release <milestone-id> <version>");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should print error and exit 1 when milestone-id is not numeric", async () => {
      await expect(releaseCommand("abc", "v1.0.0")).rejects.toThrow("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith("Milestone ID must be a valid integer");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("plan command", () => {
    it("should print usage and exit 1 when no argument is provided", async () => {
      await expect(planCommand(undefined as unknown as string)).rejects.toThrow("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith("Usage: cforge-dev plan <prd-file>");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should print error and exit 1 when file does not exist", async () => {
      await expect(planCommand("nonexistent-file.md")).rejects.toThrow("process.exit(1)");
      expect(errorSpy).toHaveBeenCalledWith("File not found: nonexistent-file.md");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
