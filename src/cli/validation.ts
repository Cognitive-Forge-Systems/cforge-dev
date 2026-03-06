export const USAGE_IMPLEMENT = "Usage: cforge-dev implement [issue-number]";
export const USAGE_VERIFY = "Usage: cforge-dev verify [pr-number]";
export const USAGE_RELEASE = "Usage: cforge-dev release [version]";
export const USAGE_PLAN = "Usage: cforge-dev plan [milestone]";

export function validatePresence(arg: string | undefined, usageMessage: string): string | null {
  if (!arg) return usageMessage;
  return null;
}

export function validateNumericIssueNumber(arg: string): string | null {
  if (!/^\d+$/.test(arg)) {
    return "Issue number must be a number";
  }
  return null;
}
