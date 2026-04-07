import * as fs from "fs";
import * as path from "path";
import { ProjectContext } from "../../domain/models/ProjectContext";
import { resolveRepoFromGit } from "./resolveRepo";

const STANDARD_CONTEXT_FILES = [
  "README.md",
  "IDEA.md",
  "ARCHITECTURE.md",
  "MEMORANDUM.md",
  "MILESTONES.md",
  "CONTRIBUTING.md",
];

export function loadContext(): ProjectContext {
  const root = process.cwd();
  const cforgeDevPath = path.join(root, "CFORGE_DEV.md");

  if (fs.existsSync(cforgeDevPath)) {
    return parseContextFromCforgeDev(fs.readFileSync(cforgeDevPath, "utf-8"));
  }

  const standardPaths = STANDARD_CONTEXT_FILES
    .map((f) => path.join(root, f))
    .filter((p) => fs.existsSync(p));

  const docsPaths = findDocsMarkdownFiles(root);
  const existingPaths = [...standardPaths, ...docsPaths];

  if (existingPaths.length === 0) {
    throw new Error("CFORGE_DEV.md not found — run cforge-dev from project root");
  }

  const content = existingPaths.map((p) => fs.readFileSync(p, "utf-8")).join("\n\n");
  return parseContextFromStandardFiles(content);
}

function findDocsMarkdownFiles(root: string): string[] {
  const docsDir = path.join(root, "docs");
  if (!fs.existsSync(docsDir)) return [];
  return walkMarkdownFiles(docsDir);
}

function walkMarkdownFiles(dir: string): string[] {
  const result: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }) as fs.Dirent[]) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        result.push(...walkMarkdownFiles(full));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        result.push(full);
      }
    }
  } catch {
    // ignore unreadable directories
  }
  return result;
}

function parseContextFromCforgeDev(content: string): ProjectContext {
  const repoField = extractField(content, "Repo");
  const fromGit = (!repoField || !repoField.includes("/")) ? resolveRepoFromGit() : undefined;

  const repoOwner = repoField?.split("/")[0] ?? fromGit?.owner ?? "unknown";
  const repoName = repoField?.split("/")[1] ?? fromGit?.repo ?? "unknown";
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

function parseContextFromStandardFiles(content: string): ProjectContext {
  const fromGit = resolveRepoFromGit();
  const repoOwner = fromGit?.owner ?? "unknown";
  const repoName = fromGit?.repo ?? "unknown";
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
