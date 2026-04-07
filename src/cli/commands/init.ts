import * as readline from "readline";
import { InitProject } from "../../application/use-cases/InitProject";
import { FileSystemDocumentStore } from "../../infrastructure/filesystem/FileSystemDocumentStore";
import { resolveRepoFromGit } from "../utils/resolveRepo";
import { USAGE_INIT } from "../validation";
import { c } from "../utils/ui";

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export async function initCommand(arg?: string): Promise<void> {
  if (arg === "--help") {
    console.log(USAGE_INIT);
    process.exit(0);
  }

  // Resolve repo coordinates from git remote (best-effort)
  const repoCoords = resolveRepoFromGit();

  const store = new FileSystemDocumentStore(process.cwd());

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // Prompt for IDEA.md answers only when the file does not yet exist
    let ideaAnswers: { problem: string; audience: string; differentiator: string } | undefined;
    if (!store.exists("IDEA.md")) {
      console.log(`\n${c.bold("Generating IDEA.md — answer three quick questions:")}\n`);
      ideaAnswers = {
        problem: await prompt(rl, "  1. What problem does this solve? "),
        audience: await prompt(rl, "  2. Who is it for? "),
        differentiator: await prompt(rl, "  3. What makes it different? "),
      };
    }

    // Ask about docs scaffolding
    const docsAnswer = await prompt(
      rl,
      `\nScaffold docs/decisions/ (ADRs) and docs/scenarios/ (SCEs)? [y/N] `,
    );
    const scaffoldDocs = docsAnswer.toLowerCase() === "y";

    rl.close();

    const result = new InitProject(store).execute({
      repoOwner: repoCoords?.owner,
      repoName: repoCoords?.repo,
      ideaAnswers,
      scaffoldDocs,
    });

    // Output summary
    console.log();
    if (result.created.length > 0) {
      console.log(c.success(`\u2713 Created:`));
      for (const f of result.created) {
        console.log(`  ${c.bold(f)}`);
      }
    }

    if (result.skipped.length > 0) {
      console.log(c.dim(`\n  Skipped (already exist): ${result.skipped.join(", ")}`));
    }

    if (result.discoveredContextFiles.length > 0) {
      console.log(c.dim(`\n  Discovered context: ${result.discoveredContextFiles.join(", ")}`));
    }

    console.log(`\n${c.success("\u2713")} ${c.bold("cforge-dev init complete.")}\n`);
  } catch (err) {
    rl.close();
    throw err;
  }
}
