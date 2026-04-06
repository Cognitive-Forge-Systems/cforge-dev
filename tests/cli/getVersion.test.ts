import { getVersion } from "../../src/cli/utils/getVersion";
import { spawnSync } from "child_process";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const TSNODE = path.join(ROOT, "node_modules/.bin/ts-node");
const CLI = path.join(ROOT, "src/cli/index.ts");

describe("getVersion", () => {
  it("returns a non-empty string", () => {
    const version = getVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("returns a valid semver version string", () => {
    const version = getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("matches the version field in package.json", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require("../../package.json") as { version: string };
    expect(getVersion()).toBe(pkg.version);
  });
});

describe("CLI version flags", () => {
  it("outputs version when --version flag is provided", () => {
    const result = spawnSync(TSNODE, [CLI, "--version"], {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("outputs version when -v flag is provided", () => {
    const result = spawnSync(TSNODE, [CLI, "-v"], {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
