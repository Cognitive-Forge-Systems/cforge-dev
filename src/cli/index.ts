#!/usr/bin/env node

import "dotenv/config";
import { planCommand } from "./commands/plan";
import { implementCommand } from "./commands/implement";
import { verifyCommand } from "./commands/verify";
import { releaseCommand } from "./commands/release";
import { chatCommand } from "./commands/chat";
import { auditCommand } from "./commands/audit";
import { getVersion } from "./utils/getVersion";

export const USAGE = `cforge-dev — AI-native SDLC orchestrator

Usage:
  cforge-dev plan <prd-file>              Plan a sprint from a PRD file
  cforge-dev implement <issue-number>     Generate Claude Code prompt for an issue
  cforge-dev implement <n> --auto         Autonomous: Claude Code implements + opens PR
  cforge-dev implement <n> --auto --max-budget 10   Set max USD budget per session
  cforge-dev verify <issue-number>        Verify issue readiness for merge
  cforge-dev release <milestone-id> <ver> Create a release from a milestone
  cforge-dev chat                         Interactive planning session
  cforge-dev audit                        Run governance audit against contracts
`;

export async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "--help") {
    console.log(USAGE);
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    console.log(getVersion());
    process.exit(0);
  }

  switch (command) {
    case "plan":
      await planCommand(args[0]);
      break;
    case "implement":
      await implementCommand(args[0], args.slice(1));
      break;
    case "verify":
      await verifyCommand(args[0]);
      break;
    case "release":
      await releaseCommand(args[0], args[1]);
      break;
    case "chat":
      await chatCommand();
      break;
    case "audit":
      await auditCommand();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(USAGE);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
