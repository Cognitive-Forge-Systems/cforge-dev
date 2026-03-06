import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ContractLoader } from "../../src/infrastructure/filesystem/ContractLoader";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "contract-test-"));
}

const SAMPLE_CONTRACT = `# Repository Standard

## Rules

### require-readme
- description: Repository must have a README.md
- severity: error
- check: file-exists
- target: README.md

### require-gitignore
- description: Repository must have a .gitignore
- severity: warning
- check: file-contains
- target: .gitignore
- pattern: node_modules
`;

describe("ContractLoader", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should parse contract markdown into GovernanceContract correctly", () => {
    fs.writeFileSync(path.join(tmpDir, "repo-standard.md"), SAMPLE_CONTRACT);
    const loader = new ContractLoader(tmpDir);

    const contracts = loader.loadAll();

    expect(contracts).toHaveLength(1);
    expect(contracts[0].id).toBe("repo-standard");
    expect(contracts[0].title).toBe("Repository Standard");
    expect(contracts[0].rules).toHaveLength(2);
  });

  it("should extract all rules with correct severity and check type", () => {
    fs.writeFileSync(path.join(tmpDir, "repo-standard.md"), SAMPLE_CONTRACT);
    const loader = new ContractLoader(tmpDir);

    const contracts = loader.loadAll();
    const rule1 = contracts[0].rules[0];
    const rule2 = contracts[0].rules[1];

    expect(rule1.id).toBe("require-readme");
    expect(rule1.severity).toBe("error");
    expect(rule1.check).toBe("file-exists");
    expect(rule1.target).toBe("README.md");

    expect(rule2.id).toBe("require-gitignore");
    expect(rule2.severity).toBe("warning");
    expect(rule2.check).toBe("file-contains");
    expect(rule2.target).toBe(".gitignore");
    expect(rule2.pattern).toBe("node_modules");
  });

  it("should return empty array when contracts/ directory is empty", () => {
    const loader = new ContractLoader(tmpDir);

    const contracts = loader.loadAll();

    expect(contracts).toHaveLength(0);
  });

  it("should ignore non-.md files in contracts/ directory", () => {
    fs.writeFileSync(path.join(tmpDir, "repo-standard.md"), SAMPLE_CONTRACT);
    fs.writeFileSync(path.join(tmpDir, "notes.txt"), "some notes");
    fs.writeFileSync(path.join(tmpDir, "data.json"), "{}");
    const loader = new ContractLoader(tmpDir);

    const contracts = loader.loadAll();

    expect(contracts).toHaveLength(1);
  });
});
