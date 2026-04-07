import * as path from "path";
import { ContractLoader } from "../../infrastructure/filesystem/ContractLoader";
import { CForgePromptGenerator } from "../../infrastructure/cforge/CForgePromptGenerator";
import { GovernanceAuditor } from "../../application/use-cases/GovernanceAuditor";
import { USAGE_AUDIT } from "../validation";
import { c } from "../utils/ui";

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
    console.error(c.error("No governance contracts found in contracts/ directory."));
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
  console.log(c.bold("══════════════════════════════════════"));
  console.log(c.bold("GOVERNANCE AUDIT — cforge-dev"));
  console.log(c.bold("══════════════════════════════════════"));

  // Group results by contract
  const byContract = new Map<string, typeof result.results>();
  for (const r of result.results) {
    const existing = byContract.get(r.contractId) ?? [];
    existing.push(r);
    byContract.set(r.contractId, existing);
  }

  for (const contract of contracts) {
    const results = byContract.get(contract.id) ?? [];
    console.log(`\n  ${c.info("CONTRACT:")} ${contract.title}`);
    console.log(c.dim("  ──────────────────────────────"));
    for (const r of results) {
      const icon = r.passed
        ? c.success("\u2705")
        : r.rule.severity === "error"
          ? c.error("\u274C")
          : c.warning("\u26A0\uFE0F ");
      const pad = r.rule.id.padEnd(24);
      const message = r.passed ? r.message : r.rule.severity === "error" ? c.error(r.message) : c.warning(r.message);
      console.log(`  ${icon} ${pad} ${message}`);
    }
  }

  const passedStr  = c.success(`${result.passed} passed`);
  const warningStr = result.warnings > 0 ? c.warning(`${result.warnings} warning(s)`) : `${result.warnings} warning(s)`;
  const errorStr   = result.errors > 0   ? c.error(`${result.errors} error(s)`)       : `${result.errors} error(s)`;

  console.log("");
  console.log(c.bold("══════════════════════════════════════"));
  console.log(`  RESULT: ${passedStr}  ${warningStr}  ${errorStr}`);
  console.log(c.bold("══════════════════════════════════════"));

  if (result.fixPlan) {
    console.log(`\n  ${c.warning("FIX PLAN")}`);
    console.log(c.dim("  ─────────"));
    console.log(`  ${result.fixPlan.split("\n").join("\n  ")}`);
  }

  if (result.errors > 0) {
    process.exit(1);
  }
}
