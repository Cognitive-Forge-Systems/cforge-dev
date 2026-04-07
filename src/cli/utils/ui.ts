import chalk from "chalk";
import ora from "ora";
import boxen from "boxen";

/** Returns true when NO_COLOR env var is set (https://no-color.org/) */
function isNoColor(): boolean {
  return !!process.env.NO_COLOR;
}

/** Color-coded output helpers */
export const c = {
  success: (s: string): string => chalk.green(s),
  error:   (s: string): string => chalk.red(s),
  warning: (s: string): string => chalk.yellow(s),
  info:    (s: string): string => chalk.blue(s),
  dim:     (s: string): string => chalk.dim(s),
  bold:    (s: string): string => chalk.bold(s),

  /** Color-coded issue type label: [BUG], [FEATURE], [TASK], [ARCHITECTURE] */
  issueType: (type: string): string => {
    switch (type.toUpperCase()) {
      case "ARCHITECTURE": return chalk.blue(`[${type}]`);
      case "FEATURE":      return chalk.green(`[${type}]`);
      case "TASK":         return chalk.yellow(`[${type}]`);
      case "BUG":          return chalk.red(`[${type}]`);
      default:             return `[${type}]`;
    }
  },

  /** Cost + turns metric, visually distinct from regular status text */
  metric: (s: string): string => chalk.cyan(s),
};

/** Create a spinner — silent when not in a TTY or NO_COLOR is set */
export function createSpinner(text: string) {
  return ora({
    text,
    isSilent: !process.stdout.isTTY || isNoColor(),
  }).start();
}

/** Print a branded welcome box (plain-text fallback when NO_COLOR is set) */
export function printWelcome(version: string, repo: string): void {
  if (isNoColor()) {
    console.log(`cforge-dev v${version}  ·  ${repo}`);
    return;
  }
  const content = [
    chalk.bold.cyan("cforge-dev") + "  " + chalk.dim(`v${version}`),
    chalk.dim(`${repo}  ·  AI-native SDLC orchestrator`),
  ].join("\n");
  console.log(
    boxen(content, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: 1,
      borderStyle: "round",
      borderColor: "cyan",
    })
  );
}
