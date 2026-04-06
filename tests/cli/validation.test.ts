import {
  validatePresence,
  validateNumericIssueNumber,
  USAGE_IMPLEMENT,
  USAGE_VERIFY,
  USAGE_RELEASE,
  USAGE_PLAN,
} from "../../src/cli/validation";

describe("validatePresence", () => {
  it("returns usage message when arg is undefined", () => {
    const result = validatePresence(undefined, USAGE_IMPLEMENT);
    expect(result).toBe(USAGE_IMPLEMENT);
  });

  it("returns usage message when arg is empty string", () => {
    const result = validatePresence("", USAGE_IMPLEMENT);
    expect(result).toBe(USAGE_IMPLEMENT);
  });

  it("returns null when arg is provided", () => {
    const result = validatePresence("42", USAGE_IMPLEMENT);
    expect(result).toBeNull();
  });
});

describe("validateNumericIssueNumber", () => {
  it("returns error message for non-numeric input", () => {
    const result = validateNumericIssueNumber("abc");
    expect(result).toBe("Issue number must be a number");
  });

  it("returns error message for alphanumeric input", () => {
    const result = validateNumericIssueNumber("12abc");
    expect(result).toBe("Issue number must be a number");
  });

  it("returns null for valid numeric input", () => {
    const result = validateNumericIssueNumber("42");
    expect(result).toBeNull();
  });

  it("returns null for numeric string with leading zeros", () => {
    const result = validateNumericIssueNumber("007");
    expect(result).toBeNull();
  });
});

describe("USAGE constants", () => {
  it("USAGE_IMPLEMENT contains correct format", () => {
    expect(USAGE_IMPLEMENT).toBe("Usage: cforge-dev implement [issue-number] [--auto] [--max-budget <usd>]");
  });

  it("USAGE_VERIFY contains correct format", () => {
    expect(USAGE_VERIFY).toBe("Usage: cforge-dev verify [pr-number]");
  });

  it("USAGE_RELEASE contains correct format", () => {
    expect(USAGE_RELEASE).toBe("Usage: cforge-dev release [version]");
  });

  it("USAGE_PLAN contains correct format", () => {
    expect(USAGE_PLAN).toBe("Usage: cforge-dev plan [milestone]");
  });
});

describe("implement command validation", () => {
  it("fails with usage when no issue number provided", () => {
    const presenceErr = validatePresence(undefined, USAGE_IMPLEMENT);
    expect(presenceErr).not.toBeNull();
    expect(presenceErr).toBe("Usage: cforge-dev implement [issue-number] [--auto] [--max-budget <usd>]");
  });

  it("fails with error when non-numeric issue number provided", () => {
    const presenceErr = validatePresence("abc", USAGE_IMPLEMENT);
    expect(presenceErr).toBeNull();
    const numericErr = validateNumericIssueNumber("abc");
    expect(numericErr).toBe("Issue number must be a number");
  });

  it("passes for valid issue number", () => {
    const presenceErr = validatePresence("5", USAGE_IMPLEMENT);
    expect(presenceErr).toBeNull();
    const numericErr = validateNumericIssueNumber("5");
    expect(numericErr).toBeNull();
  });
});

describe("verify command validation", () => {
  it("fails with usage when no pr-number provided", () => {
    const presenceErr = validatePresence(undefined, USAGE_VERIFY);
    expect(presenceErr).toBe("Usage: cforge-dev verify [pr-number]");
  });

  it("fails with error when non-numeric pr-number provided", () => {
    const numericErr = validateNumericIssueNumber("abc");
    expect(numericErr).toBe("Issue number must be a number");
  });

  it("passes for valid pr-number", () => {
    const presenceErr = validatePresence("10", USAGE_VERIFY);
    expect(presenceErr).toBeNull();
    const numericErr = validateNumericIssueNumber("10");
    expect(numericErr).toBeNull();
  });
});

describe("release command validation", () => {
  it("fails with usage when no version provided", () => {
    const presenceErr = validatePresence(undefined, USAGE_RELEASE);
    expect(presenceErr).toBe("Usage: cforge-dev release [version]");
  });

  it("passes when version is provided", () => {
    const presenceErr = validatePresence("1.0.0", USAGE_RELEASE);
    expect(presenceErr).toBeNull();
  });
});

describe("plan command validation", () => {
  it("fails with usage when no milestone provided", () => {
    const presenceErr = validatePresence(undefined, USAGE_PLAN);
    expect(presenceErr).toBe("Usage: cforge-dev plan [milestone]");
  });

  it("passes when milestone is provided", () => {
    const presenceErr = validatePresence("Sprint 1", USAGE_PLAN);
    expect(presenceErr).toBeNull();
  });
});
