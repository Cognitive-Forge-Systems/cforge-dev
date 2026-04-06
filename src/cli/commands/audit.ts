import * as path from "path";
import { ContractLoader } from "../../infrastructure/filesystem/ContractLoader";
import { CForgePromptGenerator } from "../../infrastructure/cforge/CForgePromptGenerator";
import { GovernanceAuditor } from "../../application/use-cases/GovernanceAuditor";
import { USAGE_AUDIT } from "../validation";

export async function auditCommand(flags: string[] = []): Promise<void> {
  if (flags.includes("--help")) {
    console.log(USAGE_AUDIT);
    process.exit(0);
  }

  const workingDir = process.cwd();
  const contractsDir = path.join(workingDir, "contracts");

  const loader = new ContractLoader(contractsDir);
  const contracts = loader.loadAll();

  if (contracts.length === 0) {
    console.error("No governance contracts found in contracts/ directory.");
    process.exit(1);
  }

  let promptGen: CForgePromptGenerator;
  try {
    promptGen = new CForgePromptGenerator();
  } catch {
    // If no API key, use a stub that returns empty fix plans
    promptGen = {
      generateImplementationPrompt: async () => "No API key set — run with OPENROUTER_API_KEY for AI-generated fix plans.",
      generatePlanningPrompt: async () => "",
    } as unknown as CForgePromptGenerator;
  }

  const auditor = new GovernanceAuditor(promptGen);
  const result = await auditor.execute({ workingDir, contracts });

  console.log("");
  console.log("══════════════════════════════════════");
  console.log("GOVERNANCE AUDIT — cforge-dev");
  console.log("══════════════════════════════════════");

  // Group results by contract
  const byContract = new Map<string, typeof result.results>();
  for (const r of result.results) {
    const existing = byContract.get(r.contractId) ?? [];
    existing.push(r);
    byContract.set(r.contractId, existing);
  }

  for (const contract of contracts) {
    const results = byContract.get(contract.id) ?? [];
    console.log(`\n  CONTRACT: ${contract.title}`);
    console.log("  ──────────────────────────────");
    for (const r of results) {
      const icon = r.passed ? "\u2705" : r.rule.severity === "error" ? "\u274C" : "\u26A0\uFE0F ";
      const pad = r.rule.id.padEnd(24);
      console.log(`  ${icon} ${pad} ${r.message}`);
    }
  }

  console.log("");
  console.log("══════════════════════════════════════");
  console.log(`  RESULT: ${result.passed} passed  ${result.warnings} warning(s)  ${result.errors} error(s)`);
  console.log("══════════════════════════════════════");

  if (result.fixPlan) {
    console.log("\n  FIX PLAN");
    console.log("  ─────────");
    console.log(`  ${result.fixPlan.split("\n").join("\n  ")}`);
  }

  if (result.errors > 0) {
    process.exit(1);
  }
}
