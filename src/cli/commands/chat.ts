import * as readline from "readline";
import { OctokitGitHubClient } from "../../infrastructure/github/OctokitGitHubClient";
import { CForgePromptGenerator } from "../../infrastructure/cforge/CForgePromptGenerator";
import { ChatSession } from "../../application/use-cases/ChatSession";
import { RepoStateLoader } from "../../application/use-cases/RepoStateLoader";
import { ImplementIssue } from "../../application/use-cases/ImplementIssue";
import { loadContext } from "../utils/loadContext";

const HELP = `
Commands:
  /issues          Refresh and print open issues
  /prs             Refresh and print open PRs
  /implement <n>   Run implement for issue #n inline
  /status          Print full repo state
  /refresh         Reload repo state from GitHub
  /model <name>    Switch LLM model
  /help            Print this help
  /exit            End session
`;

export async function chatCommand(): Promise<void> {
  const context = loadContext();
  const gh = new OctokitGitHubClient(context.repoOwner, context.repoName);
  const promptGen = new CForgePromptGenerator();
  const loader = new RepoStateLoader(gh);

  console.log("Loading repo state...");
  const repoState = await loader.execute();
  const session = new ChatSession(context, repoState);

  console.log("");
  console.log("╔════════════════════════════════════════╗");
  console.log("║     cforge-dev — Planning Session      ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`  Repo:     ${context.repoOwner}/${context.repoName}`);
  console.log(`  Model:    ${session.model}`);
  console.log("");
  console.log(session.getRepoSummary());
  console.log("");
  console.log("  Type /help for commands, /exit to quit.");
  console.log("────────────────────────────────────────");

  const isTTY = process.stdin.isTTY === true;
  let lineQueue: string[] | null = null;
  let rl: readline.Interface;

  if (!isTTY) {
    // Piped input: buffer all lines upfront
    const raw = await new Promise<string>((resolve) => {
      const chunks: Buffer[] = [];
      process.stdin.on("data", (chunk) => chunks.push(chunk));
      process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
    lineQueue = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  } else {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }

  let closed = false;
  rl.on("close", () => { closed = true; });

  const getInput = (): Promise<string | null> => {
    if (lineQueue) {
      const next = lineQueue.shift();
      if (next !== undefined) {
        console.log(`\nyou → ${next}`);
        return Promise.resolve(next);
      }
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      if (closed) { resolve(null); return; }
      rl.question("\nyou → ", (answer) => resolve(answer.trim()));
    });
  };

  while (true) {
    const input = await getInput();
    if (input === null) { console.log("\nSession ended."); rl.close(); return; }
    if (!input) continue;

    if (input === "/exit") {
      console.log("\nSession ended.");
      rl.close();
      return;
    }

    if (input === "/help") {
      console.log(HELP);
      continue;
    }

    if (input === "/issues") {
      const fresh = await loader.execute();
      session.updateRepoState(fresh);
      console.log("");
      if (fresh.openIssues.length === 0) {
        console.log("  No open issues.");
      } else {
        for (const issue of fresh.openIssues) {
          console.log(`  #${issue.number}  [${issue.type}]  ${issue.title}`);
        }
      }
      continue;
    }

    if (input === "/prs") {
      const fresh = await loader.execute();
      session.updateRepoState(fresh);
      console.log("");
      if (fresh.openPullRequests.length === 0) {
        console.log("  No open PRs.");
      } else {
        for (const pr of fresh.openPullRequests) {
          console.log(`  #${pr.number}  ${pr.title} (${pr.branch})`);
        }
      }
      continue;
    }

    if (input === "/status") {
      console.log("");
      console.log(session.getRepoSummary());
      continue;
    }

    if (input === "/refresh") {
      console.log("Refreshing repo state...");
      const fresh = await loader.execute();
      session.updateRepoState(fresh);
      console.log("Done.\n");
      console.log(session.getRepoSummary());
      continue;
    }

    if (input.startsWith("/model ")) {
      const newModel = input.slice(7).trim();
      if (newModel) {
        session.model = newModel;
        console.log(`  Model switched to: ${newModel}`);
      }
      continue;
    }

    if (input.startsWith("/implement ")) {
      const num = parseInt(input.slice(11).trim(), 10);
      if (isNaN(num)) {
        console.log("  Usage: /implement <issue-number>");
        continue;
      }
      try {
        const impl = new ImplementIssue(gh, promptGen);
        const result = await impl.execute({ issueNumber: num, context });
        console.log(`\n  Issue: #${result.issue.number} — ${result.issue.title}`);
        console.log(`  Branch: ${result.branch}\n`);
        console.log("══ CLAUDE CODE PROMPT ══");
        console.log(result.prompt);
        console.log("══ END PROMPT ══\n");
        console.log("  Next steps:");
        result.nextSteps.forEach((step, i) => {
          console.log(`    ${i + 1}. ${step}`);
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  Error: ${msg}`);
      }
      continue;
    }

    // Regular chat message — send to LLM
    session.addMessage("user", input);
    const messages = session.buildMessages();

    try {
      const response = await callLLM(messages, session.model);
      session.addMessage("assistant", response);
      console.log(`\ncforge-dev → ${response}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  Error: ${msg}`);
      // Remove the user message if LLM call failed
      session.history.pop();
    }
  }
}

async function callLLM(
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  return data.choices[0].message.content;
}
