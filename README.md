# cforge-dev

An AI-native SDLC orchestrator that enforces architectural discipline when building software with AI.

Built on top of [Cognitive Forge](https://github.com/Cognitive-Forge-Systems/cognitive-forge).

## What it does

cforge-dev prevents architectural regret in AI-assisted development. It enforces GitHub as the single source of truth, injects architecture context into every Claude Code session, and structures the full SDLC from PRD to release.

AI can generate code quickly — but without structure, it produces architectural debt faster than humans can detect it. cforge-dev is the guardrail.

## Commands

```
cforge-dev plan          — Create milestones, feature issues, task issues from a PRD
cforge-dev implement 42  — Generate a contextualized Claude Code prompt for issue #42
cforge-dev verify 42     — Check PR status, test results, run critique pass
cforge-dev release       — Bump version, generate changelog, create GitHub release
cforge-dev chat          — Interactive planning session (generates Claude Code prompts)
```

## SDLC Doctrine

Non-negotiable rules enforced by cforge-dev:

1. GitHub is the source of truth — no planning lives only in chat
2. No coding without an Architecture Issue
3. One issue per Claude Code session
4. Tests before implementation
5. No direct pushes to main — feature branches + PRs only
6. Every sprint ends with a release tag

## Architecture

Clean/Onion Architecture — same principles as cognitive-forge-core:

```
Domain → Application → Infrastructure → CLI
```

Domain has zero external dependencies. GitHub and cforge are infrastructure concerns.

## Setup

```bash
git clone https://github.com/Cognitive-Forge-Systems/cforge-dev
cd cforge-dev
npm install
npm run build
export GITHUB_TOKEN=your_token
export OPENROUTER_API_KEY=your_key
export CFORGE_MAX_BUDGET=5          # max USD per Claude Code session (default: 5)
cforge-dev chat
```

## Relationship to Cognitive Forge

```
cognitive-forge-core  →  reasoning engine (cforge)
cforge-dev            →  SDLC orchestrator (built on top of cforge)
Donna AI              →  corporate AI OS (built on top of both)
```

## Roadmap

- v0.1 — Scaffold + SDLCDoctrine + domain models
- v0.2 — GitHub integration (OctokitGitHubClient)
- v0.3 — PlanSprint use case (PRD → milestones + issues)
- v0.4 — ImplementIssue use case (contextualized Claude Code prompts)
- v0.5 — VerifyIssue + CreateRelease
- v1.0 — Interactive chat mode + full SDLC loop
