import * as fs from "fs";
import * as readline from "readline";
import { OctokitGitHubClient } from "../../infrastructure/github/OctokitGitHubClient";
import { CForgePromptGenerator } from "../../infrastructure/cforge/CForgePromptGenerator";
import { PlanSprint } from "../../application/use-cases/PlanSprint";
import { loadContext } from "../utils/loadContext";
import { validatePresence, USAGE_PLAN } from "../validation";
import { c, createSpinner } from "../utils/ui";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function planCommand(prdFile: string): Promise<void> {
  if (prdFile === "--help") {
    console.log(USAGE_PLAN);
    process.exit(0);
  }

  const presenceErr = validatePresence(prdFile, USAGE_PLAN);
  if (presenceErr) {
    console.error(presenceErr);
    process.exit(1);
  }

  if (!fs.existsSync(prdFile)) {
    console.error(c.error(`File not found: ${prdFile}`));
    process.exit(1);
  }

  const context = loadContext();
  const prdContent = fs.readFileSync(prdFile, "utf-8");

  const milestoneTitle = await prompt("Milestone title: ");
  const milestoneDescription = await prompt("Milestone description: ");

  const gh = new OctokitGitHubClient(context.repoOwner, context.repoName);
  const promptGen = new CForgePromptGenerator();
  const planner = new PlanSprint(gh, promptGen, context);

  const spinner = createSpinner("Planning sprint…");

  const sprint = await planner.execute({
    prdContent,
    milestoneTitle,
    milestoneDescription,
  });

  spinner.stop();

  console.log(`\n${c.success("\u2713")} ${c.bold("Milestone:")} ${sprint.milestone.title} ${c.dim(`(id: ${sprint.milestone.id})`)}`);
  console.log(`\n${c.bold(`Created ${sprint.issues.length} issues:`)}\n`);
  for (const issue of sprint.issues) {
    console.log(`  #${issue.number} ${c.issueType(issue.type)} ${issue.title}`);
  }
}
