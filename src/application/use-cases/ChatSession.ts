import { ProjectContext } from "../../domain/models/ProjectContext";
import { RepoState } from "../../domain/models/RepoState";
import { buildDevChatSystemPrompt } from "../../domain/engines/DevChatPrompt";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class ChatSession {
  readonly history: LLMMessage[];
  model: string;
  private readonly context: ProjectContext;
  private repoState: RepoState;

  constructor(context: ProjectContext, repoState: RepoState, model?: string) {
    this.context = context;
    this.repoState = repoState;
    this.history = [];
    this.model = model ?? "openai/gpt-4o";
  }

  addMessage(role: "user" | "assistant", content: string): void {
    this.history.push({ role, content });
  }

  buildMessages(): LLMMessage[] {
    const system: LLMMessage = {
      role: "system",
      content: buildDevChatSystemPrompt(this.context, this.repoState),
    };
    return [system, ...this.history];
  }

  updateRepoState(repoState: RepoState): void {
    this.repoState = repoState;
  }

  getRepoSummary(): string {
    const lines: string[] = [];

    lines.push("OPEN ISSUES");
    lines.push("───────────");
    if (this.repoState.openIssues.length > 0) {
      for (const issue of this.repoState.openIssues) {
        lines.push(`  #${issue.number}  [${issue.type}]  ${issue.title}`);
      }
    } else {
      lines.push("  none");
    }

    lines.push("");
    lines.push("OPEN PRS");
    lines.push("────────");
    if (this.repoState.openPullRequests.length > 0) {
      for (const pr of this.repoState.openPullRequests) {
        lines.push(`  #${pr.number}  ${pr.title} (${pr.branch})`);
      }
    } else {
      lines.push("  none");
    }

    lines.push("");
    lines.push("ACTIVE MILESTONE");
    lines.push("────────────────");
    lines.push(`  ${this.repoState.activeMilestone?.title ?? "none"}`);

    if (this.repoState.recentReleases.length > 0) {
      lines.push("");
      lines.push("RECENT RELEASES");
      lines.push("───────────────");
      lines.push(`  ${this.repoState.recentReleases.join(", ")}`);
    }

    return lines.join("\n");
  }
}
