import { OctokitGitHubClient } from "../../infrastructure/github/OctokitGitHubClient";
import { CreateRelease } from "../../application/use-cases/CreateRelease";
import { loadContext } from "../utils/loadContext";
import { validatePresence, USAGE_RELEASE } from "../validation";
import { c, createSpinner } from "../utils/ui";

export async function releaseCommand(milestoneIdStr: string, version: string): Promise<void> {
  if (milestoneIdStr === "--help" || version === "--help") {
    console.log(USAGE_RELEASE);
    process.exit(0);
  }

  const presenceErr = validatePresence(milestoneIdStr, USAGE_RELEASE) || validatePresence(version, USAGE_RELEASE);
  if (presenceErr) {
    console.error(presenceErr);
    process.exit(1);
  }

  const milestoneId = parseInt(milestoneIdStr, 10);
  if (isNaN(milestoneId)) {
    console.error(c.error("Milestone ID must be a valid integer"));
    process.exit(1);
  }

  const context = loadContext();
  const gh = new OctokitGitHubClient(context.repoOwner, context.repoName);
  const release = new CreateRelease(gh);

  const spinner = createSpinner("Creating release…");
  const result = await release.execute({ milestoneId, version, context });
  spinner.stop();

  console.log(`\n${c.success("\u2713")} ${c.bold("Release:")} ${result.tag}`);
  console.log(`${c.bold("Version:")} ${result.version}`);
  console.log(`${c.bold("Released at:")} ${c.dim(result.releasedAt.toISOString())}\n`);

  console.log(c.bold("Changelog:"));
  console.log(result.changelog);

  console.log(`\n${c.info(`https://github.com/${context.repoOwner}/${context.repoName}/releases/tag/${result.tag}`)}`);
}
