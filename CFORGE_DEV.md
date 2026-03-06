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
_none yet — updated after each release_

## Decision Log
_major architectural decisions recorded here as the project grows_

## Open Questions
_none yet_
