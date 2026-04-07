import { c, printWelcome } from "../../../src/cli/utils/ui";

describe("c.issueType", () => {
  it("wraps ARCHITECTURE in brackets", () => {
    expect(c.issueType("ARCHITECTURE")).toContain("[ARCHITECTURE]");
  });

  it("wraps FEATURE in brackets", () => {
    expect(c.issueType("FEATURE")).toContain("[FEATURE]");
  });

  it("wraps TASK in brackets", () => {
    expect(c.issueType("TASK")).toContain("[TASK]");
  });

  it("wraps BUG in brackets", () => {
    expect(c.issueType("BUG")).toContain("[BUG]");
  });

  it("wraps unknown types in brackets", () => {
    expect(c.issueType("CUSTOM")).toContain("[CUSTOM]");
  });
});

describe("c color helpers", () => {
  it("c.success returns string containing input", () => {
    expect(c.success("ok")).toContain("ok");
  });

  it("c.error returns string containing input", () => {
    expect(c.error("fail")).toContain("fail");
  });

  it("c.warning returns string containing input", () => {
    expect(c.warning("warn")).toContain("warn");
  });

  it("c.info returns string containing input", () => {
    expect(c.info("info")).toContain("info");
  });

  it("c.dim returns string containing input", () => {
    expect(c.dim("muted")).toContain("muted");
  });

  it("c.bold returns string containing input", () => {
    expect(c.bold("strong")).toContain("strong");
  });

  it("c.metric returns string containing input", () => {
    expect(c.metric("$0.0042")).toContain("$0.0042");
  });
});

describe("printWelcome", () => {
  let mockLog: jest.SpyInstance;

  beforeEach(() => {
    mockLog = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    mockLog.mockRestore();
  });

  it("outputs cforge-dev branding", () => {
    printWelcome("1.0.0", "owner/repo");
    const output = mockLog.mock.calls[0][0] as string;
    expect(output).toContain("cforge-dev");
  });

  it("outputs version", () => {
    printWelcome("2.3.4", "owner/repo");
    const output = mockLog.mock.calls[0][0] as string;
    expect(output).toContain("2.3.4");
  });

  it("outputs repo", () => {
    printWelcome("1.0.0", "acme/myapp");
    const output = mockLog.mock.calls[0][0] as string;
    expect(output).toContain("acme/myapp");
  });
});

describe("NO_COLOR=1 support", () => {
  let mockLog: jest.SpyInstance;
  let originalNoColor: string | undefined;

  beforeEach(() => {
    originalNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";
    mockLog = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalNoColor;
    }
    mockLog.mockRestore();
  });

  it("printWelcome outputs plain text without ANSI codes when NO_COLOR=1", () => {
    printWelcome("1.0.0", "owner/repo");
    const output = mockLog.mock.calls[0][0] as string;
    expect(output).toContain("cforge-dev");
    expect(output).toContain("1.0.0");
    expect(output).not.toMatch(/\x1b\[/);
  });

  it("printWelcome output contains repo when NO_COLOR=1", () => {
    printWelcome("1.0.0", "owner/repo");
    const output = mockLog.mock.calls[0][0] as string;
    expect(output).toContain("owner/repo");
  });
});
