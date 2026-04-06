// Mock @octokit/rest which uses ESM and cannot be loaded by ts-jest directly
jest.mock("@octokit/rest", () => ({ Octokit: jest.fn() }));

import { implementCommand } from "../../../src/cli/commands/implement";
import { planCommand } from "../../../src/cli/commands/plan";
import { verifyCommand } from "../../../src/cli/commands/verify";
import { releaseCommand } from "../../../src/cli/commands/release";
import { auditCommand } from "../../../src/cli/commands/audit";
import {
  USAGE_IMPLEMENT,
  USAGE_VERIFY,
  USAGE_RELEASE,
  USAGE_PLAN,
  USAGE_AUDIT,
} from "../../../src/cli/validation";

describe("--help flag handling", () => {
  let mockExit: jest.SpyInstance;
  let mockLog: jest.SpyInstance;
  let mockError: jest.SpyInstance;

  beforeEach(() => {
    mockExit = jest.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    mockLog = jest.spyOn(console, "log").mockImplementation(() => {});
    mockError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockLog.mockRestore();
    mockError.mockRestore();
  });

  describe("implement --help", () => {
    it("prints usage and exits with code 0 when --help is the first argument", async () => {
      await expect(implementCommand("--help", [])).rejects.toThrow("process.exit:0");
      expect(mockLog).toHaveBeenCalledWith(USAGE_IMPLEMENT);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("prints usage and exits with code 0 when --help is in flags", async () => {
      await expect(implementCommand(undefined as unknown as string, ["--help"])).rejects.toThrow("process.exit:0");
      expect(mockLog).toHaveBeenCalledWith(USAGE_IMPLEMENT);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("does not exit with error code when --help is used", async () => {
      await expect(implementCommand("--help", [])).rejects.toThrow("process.exit:0");
      expect(mockExit).not.toHaveBeenCalledWith(1);
    });
  });

  describe("plan --help", () => {
    it("prints usage and exits with code 0 when --help is passed", async () => {
      await expect(planCommand("--help")).rejects.toThrow("process.exit:0");
      expect(mockLog).toHaveBeenCalledWith(USAGE_PLAN);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("does not exit with error code when --help is used", async () => {
      await expect(planCommand("--help")).rejects.toThrow("process.exit:0");
      expect(mockExit).not.toHaveBeenCalledWith(1);
    });
  });

  describe("verify --help", () => {
    it("prints usage and exits with code 0 when --help is passed", async () => {
      await expect(verifyCommand("--help")).rejects.toThrow("process.exit:0");
      expect(mockLog).toHaveBeenCalledWith(USAGE_VERIFY);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("does not exit with error code when --help is used", async () => {
      await expect(verifyCommand("--help")).rejects.toThrow("process.exit:0");
      expect(mockExit).not.toHaveBeenCalledWith(1);
    });
  });

  describe("release --help", () => {
    it("prints usage and exits with code 0 when --help is passed as milestone", async () => {
      await expect(releaseCommand("--help", "1.0.0")).rejects.toThrow("process.exit:0");
      expect(mockLog).toHaveBeenCalledWith(USAGE_RELEASE);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("prints usage and exits with code 0 when --help is passed as version", async () => {
      await expect(releaseCommand("1", "--help")).rejects.toThrow("process.exit:0");
      expect(mockLog).toHaveBeenCalledWith(USAGE_RELEASE);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("does not exit with error code when --help is used", async () => {
      await expect(releaseCommand("--help", "1.0.0")).rejects.toThrow("process.exit:0");
      expect(mockExit).not.toHaveBeenCalledWith(1);
    });
  });

  describe("audit --help", () => {
    it("prints usage and exits with code 0 when --help is passed", async () => {
      await expect(auditCommand(["--help"])).rejects.toThrow("process.exit:0");
      expect(mockLog).toHaveBeenCalledWith(USAGE_AUDIT);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("does not exit with error code when --help is used", async () => {
      await expect(auditCommand(["--help"])).rejects.toThrow("process.exit:0");
      expect(mockExit).not.toHaveBeenCalledWith(1);
    });
  });
});
