import * as fs from "fs";
import * as path from "path";
import { ProjectContext } from "../../domain/models/ProjectContext";

export function loadContext(): ProjectContext {
  const filePath = path.join(process.cwd(), "CFORGE_DEV.md");

  if (!fs.existsSync(filePath)) {
    throw new Error("CFORGE_DEV.md not found — run cforge-dev from project root");
  }

  const content = fs.readFileSync(filePath, "utf-8");

  const repoOwner = extractField(content, "Repo") ?.split("/")[0] ?? "unknown";
  const repoName = extractField(content, "Repo")?.split("/")[1] ?? "unknown";
  const stack = extractField(content, "Stack") ?? "TypeScript";
  const architecture = extractLine(content, "Architecture") ?? "Clean Architecture";

  const rulesSection = extractSection(content, "Architecture Rules");
  const rules = rulesSection
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter((l) => l.length > 0);

  const modulesSection = extractSection(content, "Existing Modules");
  const existingModules = modulesSection
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter((l) => l.length > 0 && !l.startsWith("_"))
    .map((l) => {
      const [name, ...rest] = l.split(":");
      return { name: name.trim(), description: rest.join(":").trim() };
    });

  const questionsSection = extractSection(content, "Open Questions");
  const openQuestions = questionsSection
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter((l) => l.length > 0 && !l.startsWith("_"));

  return { repoOwner, repoName, stack, architecture, rules, existingModules, openQuestions };
}

function extractField(content: string, label: string): string | undefined {
  const regex = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i");
  const match = content.match(regex);
  return match?.[1]?.trim();
}

function extractLine(content: string, keyword: string): string | undefined {
  const line = content.split("\n").find((l) => l.includes(keyword) && l.startsWith("-"));
  return line?.replace(/^-\s*/, "").trim();
}

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = content.match(regex);
  return match?.[1]?.trim() ?? "";
}
