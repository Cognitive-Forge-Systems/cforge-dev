import { OctokitGitHubClient } from "../../infrastructure/github/OctokitGitHubClient";
import { CForgePromptGenerator } from "../../infrastructure/cforge/CForgePromptGenerator";
import { VerifyIssue } from "../../application/use-cases/VerifyIssue";
import { loadContext } from "../utils/loadContext";
import { validatePresence, validateNumericIssueNumber, USAGE_VERIFY } from "../validation";
import { c, createSpinner } from "../utils/ui";

export async function verifyCommand(issueNumberStr: string): Promise<void> {
  if (issueNumberStr === "--help") {
    console.log(USAGE_VERIFY);
    process.exit(0);
  }

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

  const spinner = createSpinner("Verifying issue…");
  const result = await verifier.execute({ issueNumber, context });
  spinner.stop();

  const readyLabel = result.ready ? c.success("YES") : c.error("NO");

  console.log(`\n${c.bold("Issue:")} #${result.issue.number} — ${result.issue.title}`);
  console.log(`${c.bold("Ready:")} ${readyLabel}`);

  if (result.pr) {
    console.log(`${c.bold("PR:")} #${result.pr.number} — ${result.pr.title}`);
  } else {
    console.log(`${c.bold("PR:")} ${c.dim("none found")}`);
  }

  if (result.blockers.length > 0) {
    console.log(`\n${c.error("Blockers:")}`);
    result.blockers.forEach((b) => console.log(`  ${c.error("-")} ${b}`));
  }

  console.log(`\n${c.bold("Critique:")}`);
  console.log(result.critique);

  console.log(`\n${c.bold("Next steps:")}`);
  result.nextSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });
}
