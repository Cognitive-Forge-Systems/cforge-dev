import { ProjectContext } from "../models/ProjectContext";
import { RepoState } from "../models/RepoState";

export function buildDevChatSystemPrompt(context: ProjectContext, repoState: RepoState): string {
  const issuesList = repoState.openIssues.length > 0
    ? repoState.openIssues.map((i) => `  #${i.number}  [${i.type}]  ${i.title}`).join("\n")
    : "  none";

  const prsList = repoState.openPullRequests.length > 0
    ? repoState.openPullRequests.map((p) => `  #${p.number}  ${p.title} (${p.branch})`).join("\n")
    : "  none";

  const milestoneLine = repoState.activeMilestone
    ? repoState.activeMilestone.title
    : "none";

  const releasesLine = repoState.recentReleases.length > 0
    ? repoState.recentReleases.join(", ")
    : "none";

  const modulesList = context.existingModules.length > 0
    ? context.existingModules.map((m) => `- ${m.name}: ${m.description}`).join("\n")
    : "none";

  return `You are cforge-dev — an AI-native SDLC orchestrator. You help plan, implement, and ship software with architectural discipline.

## Project Context
- Repo: ${context.repoOwner}/${context.repoName}
- Stack: ${context.stack}
- Architecture: ${context.architecture}
- Rules: ${context.rules.join(", ") || "none"}
- Existing Modules:
${modulesList}

## Current Repo State
Open Issues:
${issuesList}

Open PRs:
${prsList}

Active Milestone: ${milestoneLine}
Recent Releases: ${releasesLine}

## Instructions
When asked to generate a Claude Code prompt, output it inside:
══ CLAUDE CODE PROMPT ══
<prompt>
══ END PROMPT ══
The prompt must include: issue context, acceptance criteria, stack constraints, architecture rules, TDD requirement.

Be concise, direct, and opinionated. You know the repo state — use it to give specific, actionable advice.`;
}
