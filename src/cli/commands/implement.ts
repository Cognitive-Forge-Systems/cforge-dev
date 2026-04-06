import { execSync } from "child_process";
import { OctokitGitHubClient } from "../../infrastructure/github/OctokitGitHubClient";
import { CForgePromptGenerator } from "../../infrastructure/cforge/CForgePromptGenerator";
import { ClaudeCodeRunner } from "../../infrastructure/claude/ClaudeCodeRunner";
import { ImplementIssue } from "../../application/use-cases/ImplementIssue";
import { AutoImplement } from "../../application/use-cases/AutoImplement";
import { loadContext } from "../utils/loadContext";
import { validatePresence, validateNumericIssueNumber, USAGE_IMPLEMENT } from "../validation";

export async function implementCommand(issueNumberStr: string, flags: string[] = []): Promise<void> {
  if (issueNumberStr === "--help" || flags.includes("--help")) {
    console.log(USAGE_IMPLEMENT);
    process.exit(0);
  }

  const presenceErr = validatePresence(issueNumberStr, USAGE_IMPLEMENT);
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

  const isAuto = flags.includes("--auto");
  const maxBudget = parseFlagValue(flags, "--max-budget");

  if (isAuto) {
    await runAutoImplement(issueNumber, maxBudget);
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

function parseFlagValue(flags: string[], flag: string): number | undefined {
  const idx = flags.indexOf(flag);
  if (idx === -1 || idx + 1 >= flags.length) return undefined;
  const val = Number(flags[idx + 1]);
  if (Number.isNaN(val) || val <= 0) {
    console.error(`Invalid value for ${flag}: ${flags[idx + 1]}`);
    process.exit(1);
  }
  return val;
}

async function runAutoImplement(issueNumber: number, maxBudgetUsd?: number): Promise<void> {
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
    maxBudgetUsd,
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
