# CFORGE_DEV.md — Project Context

## Identity
- **Repo:** Cognitive-Forge-Systems/cforge-dev
- **Binary:** cforge-dev
- **Purpose:** AI-native SDLC orchestrator — enforces architectural
  discipline when building software with AI

## Stack
- TypeScript, Node.js
- Clean/Onion Architecture — Domain → Application → Infrastructure → CLI
- GitHub API via @octokit/rest
- cforge (cognitive-forge-core) as internal reasoning engine

## Architecture Rules
- Domain never imports from Infrastructure
- All use cases injected with interfaces, never concrete implementations
- TDD-first on all domain and application logic
- No direct pushes to main — feature branches + PRs only
- One GitHub issue per Claude Code session
- Conventional commits

## Existing Modules
- SDLCDoctrine — pure domain validation (branch names, PR readiness, release gates)
- OctokitGitHubClient — GitHub API adapter (milestones, issues, branches, PRs, releases)
- PlanSprint — PRD → milestone + ordered issues (architecture first)
- ImplementIssue — issue → branch + contextualized Claude Code prompt
- VerifyIssue — PR readiness check + critique pass
- CreateRelease — changelog generation + GitHub release
- CForgePromptGenerator — OpenRouter-backed prompt generation
- ChatSession — repo-aware planning session with history
- RepoStateLoader — parallel GitHub state fetcher

## Decision Log
- v0.1.0: Clean/Onion Architecture chosen — domain never imports infrastructure
- v0.1.0: @octokit/rest for GitHub API — clean interface abstraction
- v0.1.0: gh auth token fallback — no GITHUB_TOKEN required locally
- v0.2.0: dotenv for local env — .env never committed
- v0.2.0: RepoState injected into chat system prompt — LLM always has live repo context
- v0.3.0: GitHub Actions CI on all PRs — cforge-dev verify reads real check results
- v0.3.0: Branch protection on main — SDLC doctrine enforced at GitHub level

## Open Questions
_none yet_
