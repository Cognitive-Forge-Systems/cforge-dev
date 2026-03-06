import { OctokitGitHubClient } from "../../infrastructure/github/OctokitGitHubClient";
import { CreateRelease } from "../../application/use-cases/CreateRelease";
import { loadContext } from "../utils/loadContext";

export async function releaseCommand(milestoneIdStr: string, version: string): Promise<void> {
  if (!milestoneIdStr || !version) {
    console.error("Usage: cforge-dev release <milestone-id> <version>");
    process.exit(1);
  }

  const milestoneId = parseInt(milestoneIdStr, 10);
  if (isNaN(milestoneId)) {
    console.error("Milestone ID must be a valid integer");
    process.exit(1);
  }

  const context = loadContext();
  const gh = new OctokitGitHubClient(context.repoOwner, context.repoName);
  const release = new CreateRelease(gh);

  const result = await release.execute({ milestoneId, version, context });

  console.log(`\nRelease: ${result.tag}`);
  console.log(`Version: ${result.version}`);
  console.log(`Released at: ${result.releasedAt.toISOString()}\n`);

  console.log("Changelog:");
  console.log(result.changelog);

  console.log(`\nhttps://github.com/${context.repoOwner}/${context.repoName}/releases/tag/${result.tag}`);
}
