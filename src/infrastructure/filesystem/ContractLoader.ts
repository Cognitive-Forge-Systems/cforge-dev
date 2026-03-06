import * as fs from "fs";
import * as path from "path";
import { GovernanceContract } from "../../domain/models/GovernanceContract";
import { GovernanceRule } from "../../domain/models/GovernanceRule";

export class ContractLoader {
  private readonly contractsDir: string;

  constructor(contractsDir: string) {
    this.contractsDir = contractsDir;
  }

  loadAll(): GovernanceContract[] {
    if (!fs.existsSync(this.contractsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.contractsDir).filter((f) => f.endsWith(".md"));
    return files.map((file) => this.parseContract(file));
  }

  private parseContract(filename: string): GovernanceContract {
    const filePath = path.join(this.contractsDir, filename);
    const content = fs.readFileSync(filePath, "utf-8");
    const id = filename.replace(/\.md$/, "");

    const titleMatch = content.match(/^# (.+)/m);
    const title = titleMatch?.[1]?.trim() ?? id;

    const rules = this.parseRules(content);

    return { id, title, rules };
  }

  private parseRules(content: string): GovernanceRule[] {
    const rules: GovernanceRule[] = [];
    const ruleBlocks = content.split(/^### /m).slice(1);

    for (const block of ruleBlocks) {
      const lines = block.trim().split("\n");
      const id = lines[0].trim();

      const description = this.extractField(lines, "description") ?? "";
      const severity = this.extractField(lines, "severity") as "error" | "warning" ?? "warning";
      const check = this.extractField(lines, "check") as GovernanceRule["check"] ?? "file-exists";
      const target = this.extractField(lines, "target");
      const pattern = this.extractField(lines, "pattern");

      rules.push({ id, description, severity, check, target, pattern });
    }

    return rules;
  }

  private extractField(lines: string[], field: string): string | undefined {
    const line = lines.find((l) => l.trim().startsWith(`- ${field}:`));
    if (!line) return undefined;
    const value = line.split(`- ${field}:`)[1]?.trim();
    return value?.replace(/^["']|["']$/g, "") ?? undefined;
  }
}
