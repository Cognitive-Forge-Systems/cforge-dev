import { parseGitRemoteUrl, resolveRepoFromGit } from "../../src/cli/utils/resolveRepo";

jest.mock("child_process");
import { execSync } from "child_process";
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("parseGitRemoteUrl", () => {
  describe("HTTPS URLs", () => {
    it("parses standard HTTPS URL with .git suffix", () => {
      expect(parseGitRemoteUrl("https://github.com/owner/repo.git")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("parses HTTPS URL without .git suffix", () => {
      expect(parseGitRemoteUrl("https://github.com/owner/repo")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("parses HTTPS URL with trailing whitespace/newline", () => {
      expect(parseGitRemoteUrl("https://github.com/myorg/my-repo.git\n")).toEqual({
        owner: "myorg",
        repo: "my-repo",
      });
    });

    it("parses HTTPS URL with hyphenated org and repo names", () => {
      expect(parseGitRemoteUrl("https://github.com/cognitive-forge/cforge-dev.git")).toEqual({
        owner: "cognitive-forge",
        repo: "cforge-dev",
      });
    });

    it("parses HTTP (non-TLS) URL", () => {
      expect(parseGitRemoteUrl("http://github.com/owner/repo.git")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });
  });

  describe("SSH URLs", () => {
    it("parses standard SSH URL with .git suffix", () => {
      expect(parseGitRemoteUrl("git@github.com:owner/repo.git")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("parses SSH URL without .git suffix", () => {
      expect(parseGitRemoteUrl("git@github.com:owner/repo")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("parses SSH URL with trailing whitespace/newline", () => {
      expect(parseGitRemoteUrl("git@github.com:myorg/my-repo.git\n")).toEqual({
        owner: "myorg",
        repo: "my-repo",
      });
    });

    it("parses SSH URL for GitLab host", () => {
      expect(parseGitRemoteUrl("git@gitlab.com:owner/repo.git")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });
  });

  describe("invalid URLs", () => {
    it("returns undefined for empty string", () => {
      expect(parseGitRemoteUrl("")).toBeUndefined();
    });

    it("returns undefined for a plain string", () => {
      expect(parseGitRemoteUrl("not-a-url")).toBeUndefined();
    });

    it("returns undefined for HTTPS URL missing repo segment", () => {
      expect(parseGitRemoteUrl("https://github.com/owner")).toBeUndefined();
    });

    it("returns undefined for SSH URL without slash in path", () => {
      expect(parseGitRemoteUrl("git@github.com:no-slash")).toBeUndefined();
    });
  });
});

describe("resolveRepoFromGit", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns parsed owner and repo from HTTPS remote URL", () => {
    mockExecSync.mockReturnValueOnce("https://github.com/Cognitive-Forge-Systems/cforge-dev.git\n");

    expect(resolveRepoFromGit()).toEqual({
      owner: "Cognitive-Forge-Systems",
      repo: "cforge-dev",
    });
    expect(mockExecSync).toHaveBeenCalledWith("git remote get-url origin", { encoding: "utf-8" });
  });

  it("returns parsed owner and repo from SSH remote URL", () => {
    mockExecSync.mockReturnValueOnce("git@github.com:Cognitive-Forge-Systems/cforge-dev.git\n");

    expect(resolveRepoFromGit()).toEqual({
      owner: "Cognitive-Forge-Systems",
      repo: "cforge-dev",
    });
  });

  it("returns undefined when git command fails", () => {
    mockExecSync.mockImplementationOnce(() => { throw new Error("not a git repo"); });

    expect(resolveRepoFromGit()).toBeUndefined();
  });

  it("returns undefined when remote URL cannot be parsed", () => {
    mockExecSync.mockReturnValueOnce("not-a-valid-url");

    expect(resolveRepoFromGit()).toBeUndefined();
  });
});
