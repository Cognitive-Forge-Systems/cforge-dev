import * as readline from "readline";
import { BranchConflictResolver } from "../../domain/interfaces/BranchConflictResolver";
import { BranchConflictAction } from "../../domain/models/BranchConflictAction";
import { c } from "./ui";

export class StdinBranchConflictResolver implements BranchConflictResolver {
  async resolve(branch: string): Promise<BranchConflictAction> {
    console.log(`\n${c.warning(`Branch '${branch}' already exists on remote.`)}`);
    console.log(`  ${c.bold("(c)")} Continue — check out the existing branch and resume`);
    console.log(`  ${c.bold("(r)")} Reset    — delete the existing branch and start fresh`);
    console.log(`  ${c.bold("(a)")} Abort    — exit without making any changes`);

    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      const ask = () => {
        rl.question(`\n${c.dim("Your choice [c/r/a]: ")}`, (answer) => {
          const choice = answer.trim().toLowerCase();
          if (choice === "c" || choice === "continue") {
            rl.close();
            resolve("continue");
          } else if (choice === "r" || choice === "reset") {
            rl.close();
            resolve("reset");
          } else if (choice === "a" || choice === "abort") {
            rl.close();
            resolve("abort");
          } else {
            console.log(c.error("  Please enter c, r, or a."));
            ask();
          }
        });
      };

      ask();
    });
  }
}
