import { OctokitGitHubClient } from "../../infrastructure/github/OctokitGitHubClient";
import { CForgePromptGenerator } from "../../infrastructure/cforge/CForgePromptGenerator";
import { ImplementIssue } from "../../application/use-cases/ImplementIssue";
import { loadContext } from "../utils/loadContext";

export async function implementCommand(issueNumberStr: string): Promise<void> {
  if (!issueNumberStr) {
    console.error("Usage: cforge-dev implement <issue-number>");
    process.exit(1);
  }

  const issueNumber = parseInt(issueNumberStr, 10);
  if (isNaN(issueNumber)) {
    console.error("Issue number must be a valid integer");
    process.exit(1);
  }

  const context = loadContext();
  const gh = new OctokitGitHubClient(context.repoOwner, context.repoName);
  const promptGen = new CForgePromptGenerator();
  const impl = new ImplementIssue(gh, promptGen);

  const result = await impl.execute({ issueNumber, context });

  console.log(`\nIssue: #${result.issue.number} — ${result.issue.title}`);
  console.log(`Branch: ${result.branch}\n`);

  console.log("══ CLAUDE CODE PROMPT ══");
  console.log(result.prompt);
  console.log("══ END PROMPT ══\n");

  console.log("Next steps:");
  result.nextSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });
}
