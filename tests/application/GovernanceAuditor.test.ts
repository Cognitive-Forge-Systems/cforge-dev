import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { GovernanceAuditor } from "../../src/application/use-cases/GovernanceAuditor";
import { GovernanceRule } from "../../src/domain/models/GovernanceRule";
import { GovernanceContract } from "../../src/domain/models/GovernanceContract";
import { PromptGenerator } from "../../src/domain/interfaces/PromptGenerator";

function makeRule(overrides: Partial<GovernanceRule> = {}): GovernanceRule {
  return {
    id: "test-rule",
    description: "Test rule",
    severity: "error",
    check: "file-exists",
    target: "README.md",
    ...overrides,
  };
}

function makeContract(rules: GovernanceRule[]): GovernanceContract {
  return {
    id: "test-contract",
    title: "Test Contract",
    rules,
  };
}

function mockPromptGenerator(): PromptGenerator {
  return {
    generateImplementationPrompt: jest.fn().mockResolvedValue("Fix: create the missing files"),
    generatePlanningPrompt: jest.fn(),
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "audit-test-"));
}

describe("GovernanceAuditor", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("file-exists rule — file present → passed: true", async () => {
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Hello");
    const contracts = [makeContract([makeRule({ id: "require-readme", target: "README.md" })])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: tmpDir, contracts });

    expect(result.results[0].passed).toBe(true);
  });

  it("file-exists rule — file missing → passed: false, fix suggested", async () => {
    const contracts = [makeContract([makeRule({ id: "require-readme", target: "README.md" })])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: tmpDir, contracts });

    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].fix).toBeDefined();
  });

  it("file-contains rule — pattern found → passed: true", async () => {
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Project\ncforge-dev commands");
    const rule = makeRule({ id: "has-commands", check: "file-contains", target: "README.md", pattern: "cforge-dev" });
    const contracts = [makeContract([rule])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: tmpDir, contracts });

    expect(result.results[0].passed).toBe(true);
  });

  it("file-contains rule — pattern missing → passed: false", async () => {
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Project\nNothing here");
    const rule = makeRule({ id: "has-commands", check: "file-contains", target: "README.md", pattern: "cforge-dev" });
    const contracts = [makeContract([rule])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: tmpDir, contracts });

    expect(result.results[0].passed).toBe(false);
  });

  it("all rules pass → errors: 0, warnings: 0", async () => {
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Hello");
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/");
    const contracts = [makeContract([
      makeRule({ id: "r1", target: "README.md" }),
      makeRule({ id: "r2", target: ".gitignore" }),
    ])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: tmpDir, contracts });

    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it("one error rule fails → errors: 1", async () => {
    const contracts = [makeContract([
      makeRule({ id: "r1", target: "MISSING.md", severity: "error" }),
    ])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: tmpDir, contracts });

    expect(result.errors).toBe(1);
  });

  it("one warning rule fails → warnings: 1, errors: 0", async () => {
    const contracts = [makeContract([
      makeRule({ id: "r1", target: "OPTIONAL.md", severity: "warning" }),
    ])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: tmpDir, contracts });

    expect(result.warnings).toBe(1);
    expect(result.errors).toBe(0);
  });

  it("PromptGenerator called with violations for fix plan", async () => {
    const contracts = [makeContract([
      makeRule({ id: "r1", target: "MISSING.md", severity: "error" }),
    ])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: tmpDir, contracts });

    expect(prompt.generateImplementationPrompt).toHaveBeenCalled();
    expect(result.fixPlan.length).toBeGreaterThan(0);
  });

  it("returns correct totalRules count", async () => {
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Hello");
    const contracts = [makeContract([
      makeRule({ id: "r1", target: "README.md" }),
      makeRule({ id: "r2", target: "README.md" }),
      makeRule({ id: "r3", target: "README.md" }),
    ])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: tmpDir, contracts });

    expect(result.totalRules).toBe(3);
  });

  it("commit-format rule — valid conventional commit → passed: true", async () => {
    // Create a temp git repo with a conventional commit
    const gitDir = createTempDir();
    const { execSync } = require("child_process");
    execSync("git init", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.email 'test@test.com'", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.name 'Test'", { cwd: gitDir, stdio: "ignore" });
    fs.writeFileSync(path.join(gitDir, "file.txt"), "hello");
    execSync("git add . && git commit -m 'feat: add initial file'", { cwd: gitDir, stdio: "ignore" });

    const rule = makeRule({
      id: "conventional",
      check: "commit-format",
      pattern: "^(feat|fix|chore|docs|refactor|test|ci)(\\(.+\\))?: .+",
    });
    const contracts = [makeContract([rule])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: gitDir, contracts });

    expect(result.results[0].passed).toBe(true);

    fs.rmSync(gitDir, { recursive: true, force: true });
  });

  it("commit-format rule — invalid commit message → passed: false", async () => {
    // Create a temp git repo with a non-conventional commit
    const gitDir = createTempDir();
    const { execSync } = require("child_process");
    execSync("git init", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.email 'test@test.com'", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.name 'Test'", { cwd: gitDir, stdio: "ignore" });
    fs.writeFileSync(path.join(gitDir, "file.txt"), "hello");
    execSync("git add . && git commit -m 'bad commit message'", { cwd: gitDir, stdio: "ignore" });

    const rule = makeRule({
      id: "conventional",
      check: "commit-format",
      pattern: "^(feat|fix|chore|docs|refactor|test|ci)(\\(.+\\))?: .+",
    });
    const contracts = [makeContract([rule])];
    const prompt = mockPromptGenerator();
    const auditor = new GovernanceAuditor(prompt);

    const result = await auditor.execute({ workingDir: gitDir, contracts });

    expect(result.results[0].passed).toBe(false);

    fs.rmSync(gitDir, { recursive: true, force: true });
  });
});
