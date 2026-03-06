import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { GovernanceContract } from "../../domain/models/GovernanceContract";
import { GovernanceRule } from "../../domain/models/GovernanceRule";
import { AuditResult } from "../../domain/models/AuditResult";
import { PromptGenerator } from "../../domain/interfaces/PromptGenerator";
import { IssueType } from "../../domain/models/Issue";

export interface GovernanceAuditInput {
  workingDir: string;
  contracts: GovernanceContract[];
}

export interface GovernanceAuditOutput {
  totalRules: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: number;
  results: AuditResult[];
  summary: string;
  fixPlan: string;
}

export class GovernanceAuditor {
  private readonly promptGen: PromptGenerator;

  constructor(promptGen: PromptGenerator) {
    this.promptGen = promptGen;
  }

  async execute(input: GovernanceAuditInput): Promise<GovernanceAuditOutput> {
    const results: AuditResult[] = [];

    for (const contract of input.contracts) {
      for (const rule of contract.rules) {
        const result = this.checkRule(rule, contract.id, input.workingDir);
        results.push(result);
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const errors = results.filter((r) => !r.passed && r.rule.severity === "error").length;
    const warnings = results.filter((r) => !r.passed && r.rule.severity === "warning").length;

    let summary = "";
    let fixPlan = "";

    const violations = results.filter((r) => !r.passed);
    if (violations.length > 0) {
      const violationText = violations
        .map((v) => `- [${v.rule.severity}] ${v.rule.id}: ${v.message}`)
        .join("\n");

      const issue = {
        id: 0,
        number: 0,
        title: "Governance Audit Violations",
        body: `The following governance violations were found:\n\n${violationText}`,
        type: IssueType.TASK,
      };

      const context = {
        repoOwner: "",
        repoName: "",
        stack: "",
        architecture: "",
        rules: [],
        existingModules: [],
        openQuestions: [],
      };

      fixPlan = await this.promptGen.generateImplementationPrompt(issue, context);
      summary = `${violations.length} violation(s) found: ${errors} error(s), ${warnings} warning(s)`;
    } else {
      summary = "All governance rules passed.";
    }

    return {
      totalRules: results.length,
      passed,
      failed,
      warnings,
      errors,
      results,
      summary,
      fixPlan,
    };
  }

  private checkRule(rule: GovernanceRule, contractId: string, workingDir: string): AuditResult {
    switch (rule.check) {
      case "file-exists":
        return this.checkFileExists(rule, contractId, workingDir);
      case "file-contains":
        return this.checkFileContains(rule, contractId, workingDir);
      case "commit-format":
        return this.checkCommitFormat(rule, contractId, workingDir);
      case "branch-format":
        return this.checkBranchFormat(rule, contractId, workingDir);
      default:
        return { contractId, rule, passed: false, message: `Unknown check type: ${rule.check}` };
    }
  }

  private checkFileExists(rule: GovernanceRule, contractId: string, workingDir: string): AuditResult {
    const target = rule.target ?? "";
    const filePath = path.join(workingDir, target);
    const exists = fs.existsSync(filePath);

    return {
      contractId,
      rule,
      passed: exists,
      message: exists ? `${target} exists` : `${target} not found`,
      fix: exists ? undefined : `Create ${target} in the project root`,
    };
  }

  private checkFileContains(rule: GovernanceRule, contractId: string, workingDir: string): AuditResult {
    const target = rule.target ?? "";
    const pattern = rule.pattern ?? "";
    const filePath = path.join(workingDir, target);

    if (!fs.existsSync(filePath)) {
      return {
        contractId,
        rule,
        passed: false,
        message: `${target} not found`,
        fix: `Create ${target} with required content`,
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const found = content.includes(pattern);

    return {
      contractId,
      rule,
      passed: found,
      message: found ? `${pattern} found in ${target}` : `${pattern} not found in ${target}`,
      fix: found ? undefined : `Add "${pattern}" to ${target}`,
    };
  }

  private checkCommitFormat(rule: GovernanceRule, contractId: string, workingDir: string): AuditResult {
    const pattern = rule.pattern ?? "";
    const regex = new RegExp(pattern);

    let commits: string[];
    try {
      const output = execSync("git log --oneline -10 --format=%s", {
        cwd: workingDir,
        encoding: "utf-8",
      });
      commits = output.trim().split("\n").filter((l) => l.length > 0);
    } catch {
      return { contractId, rule, passed: false, message: "Not a git repository" };
    }

    if (commits.length === 0) {
      return { contractId, rule, passed: true, message: "No commits to check" };
    }

    const failing = commits.filter((c) => !regex.test(c));
    const passed = failing.length === 0;

    return {
      contractId,
      rule,
      passed,
      message: passed
        ? `All ${commits.length} recent commits follow format`
        : `${failing.length} of ${commits.length} recent commits fail format`,
      fix: passed ? undefined : `Fix commit messages: ${failing.slice(0, 3).join(", ")}`,
    };
  }

  private checkBranchFormat(rule: GovernanceRule, contractId: string, workingDir: string): AuditResult {
    const pattern = rule.pattern ?? "";
    const regex = new RegExp(pattern);

    let branch: string;
    try {
      branch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: workingDir,
        encoding: "utf-8",
      }).trim();
    } catch {
      return { contractId, rule, passed: false, message: "Not a git repository" };
    }

    const passed = regex.test(branch);

    return {
      contractId,
      rule,
      passed,
      message: passed ? `Branch "${branch}" matches format` : `Branch "${branch}" does not match format`,
      fix: passed ? undefined : `Rename branch to match pattern: ${pattern}`,
    };
  }
}
