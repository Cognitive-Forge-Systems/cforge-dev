import { OctokitGitHubClient } from "../../infrastructure/github/OctokitGitHubClient";
import { CForgePromptGenerator } from "../../infrastructure/cforge/CForgePromptGenerator";
import { VerifyIssue } from "../../application/use-cases/VerifyIssue";
import { loadContext } from "../utils/loadContext";
import { validatePresence, validateNumericIssueNumber, USAGE_VERIFY } from "../validation";

export async function verifyCommand(issueNumberStr: string): Promise<void> {
  const presenceErr = validatePresence(issueNumberStr, USAGE_VERIFY);
  if (presenceErr) {
    console.error(presenceErr);
    process.exit(1);
  }

  const numericErr = validateNumericIssueNumber(issueNumberStr);
  if (numericErr) {
    console.error(numericErr);
    process.exit(1);
  }

  const issueNumber = parseInt(issueNumberStr, 10);

  const context = loadContext();
  const gh = new OctokitGitHubClient(context.repoOwner, context.repoName);
  const promptGen = new CForgePromptGenerator();
  const verifier = new VerifyIssue(gh, promptGen);

  const result = await verifier.execute({ issueNumber, context });

  console.log(`\nIssue: #${result.issue.number} — ${result.issue.title}`);
  console.log(`Ready: ${result.ready ? "YES" : "NO"}`);

  if (result.pr) {
    console.log(`PR: #${result.pr.number} — ${result.pr.title}`);
  } else {
    console.log("PR: none found");
  }

  if (result.blockers.length > 0) {
    console.log("\nBlockers:");
    result.blockers.forEach((b) => console.log(`  - ${b}`));
  }

  console.log("\nCritique:");
  console.log(result.critique);

  console.log("\nNext steps:");
  result.nextSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });
}
