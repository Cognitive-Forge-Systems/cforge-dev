import { execSync } from "child_process";

export interface RepoCoordinates {
  owner: string;
  repo: string;
}

/**
 * Parses a git remote URL (SSH or HTTPS) and extracts owner and repo name.
 *
 * Handles:
 *   https://github.com/owner/repo.git
 *   https://github.com/owner/repo
 *   git@github.com:owner/repo.git
 *   git@github.com:owner/repo
 */
export function parseGitRemoteUrl(url: string): RepoCoordinates | undefined {
  const trimmed = url.trim();

  // HTTPS: https://github.com/owner/repo[.git]
  const httpsMatch = trimmed.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?\s*$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // SSH: git@github.com:owner/repo[.git]
  const sshMatch = trimmed.match(/^git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?\s*$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return undefined;
}

/**
 * Resolves repo owner and name from `git remote get-url origin`.
 * Returns undefined if git is unavailable or the URL cannot be parsed.
 */
export function resolveRepoFromGit(): RepoCoordinates | undefined {
  try {
    const url = execSync("git remote get-url origin", { encoding: "utf-8" });
    return parseGitRemoteUrl(url);
  } catch {
    return undefined;
  }
}
