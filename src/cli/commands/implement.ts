import { execSync } from "child_process";
import { OctokitGitHubClient } from "../../infrastructure/github/OctokitGitHubClient";
import { CForgePromptGenerator } from "../../infrastructure/cforge/CForgePromptGenerator";
import { ClaudeCodeRunner } from "../../infrastructure/claude/ClaudeCodeRunner";
import { ImplementIssue } from "../../application/use-cases/ImplementIssue";
import { AutoImplement } from "../../application/use-cases/AutoImplement";
import { loadContext } from "../utils/loadContext";

export async function implementCommand(issueNumberStr: string, flags: string[] = []): Promise<void> {
  if (!issueNumberStr) {
    console.error("Usage: cforge-dev implement <issue-number> [--auto]");
    process.exit(1);
  }

  const issueNumber = parseInt(issueNumberStr, 10);
  if (isNaN(issueNumber)) {
    console.error("Issue number must be a number");
    process.exit(1);
  }

  const isAuto = flags.includes("--auto");

  if (isAuto) {
    await runAutoImplement(issueNumber);
  } else {
    await runManualImplement(issueNumber);
  }
}

async function runManualImplement(issueNumber: number): Promise<void> {
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

async function runAutoImplement(issueNumber: number): Promise<void> {
  const context = loadContext();
  const gh = new OctokitGitHubClient(context.repoOwner, context.repoName);
  const promptGen = new CForgePromptGenerator();
  const codeRunner = new ClaudeCodeRunner();

  const testRunner = async (dir: string): Promise<{ passed: boolean; output: string }> => {
    try {
      const output = execSync("npm test", { cwd: dir, encoding: "utf-8", timeout: 120000 });
      return { passed: true, output };
    } catch (err: unknown) {
      const output = err instanceof Error && "stdout" in err ? (err as { stdout: string }).stdout : String(err);
      return { passed: false, output };
    }
  };

  const auto = new AutoImplement(gh, promptGen, codeRunner, testRunner);

  console.log("");
  console.log("══════════════════════════════════════");
  console.log(`AUTO-IMPLEMENT — Issue #${issueNumber}`);
  console.log("══════════════════════════════════════");

  const result = await auto.execute({
    issueNumber,
    context,
  });

  if (result.success) {
    console.log(`  \u2713 Claude session complete ($${result.cost.toFixed(4)}, ${result.turns} turns)`);
    console.log(`  \u2713 Tests passed`);
    if (result.prUrl) {
      console.log(`  \u2713 PR opened: ${result.prUrl}`);
    }
    if (result.retried) {
      console.log("  (retry was needed)");
    }
    console.log("");
    console.log("══════════════════════════════════════");
    console.log("DONE — Review PR and merge when ready");
    console.log(`cforge-dev verify ${issueNumber}`);
    console.log("══════════════════════════════════════");
  } else {
    console.log(`  \u2717 ${result.error}`);
    if (result.retried) {
      console.log("  \u2717 Tests failed after retry");
    }
    if (result.manualStepsRequired.length > 0) {
      console.log("\n  Manual steps required:");
      result.manualStepsRequired.forEach((step, i) => {
        console.log(`    ${i + 1}. ${step}`);
      });
    }
  }
}
