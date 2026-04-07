import { DocumentStore } from "../../domain/interfaces/DocumentStore";
import { InitProjectDto, IdeaAnswers } from "../dtos/InitProjectDto";

export interface InitProjectResult {
  /** Files created during this run. */
  created: string[];
  /** Files that were skipped because they already exist or data was absent. */
  skipped: string[];
  /** Existing context files discovered before any writes occurred. */
  discoveredContextFiles: string[];
}

/**
 * Standard context files read by cforge-dev at runtime, in loading order.
 * A well-structured repository means CFORGE_DEV.md needs minimal overrides.
 */
export const CONTEXT_FILE_ORDER = [
  "README.md",
  "IDEA.md",
  "ARCHITECTURE.md",
  "MEMORANDUM.md",
  "MILESTONES.md",
  "CONTRIBUTING.md",
  "CFORGE_DEV.md",
] as const;

export class InitProject {
  constructor(private readonly store: DocumentStore) {}

  execute(input: InitProjectDto): InitProjectResult {
    const created: string[] = [];
    const skipped: string[] = [];

    // Step 1 — Discover existing context before any writes
    const discoveredContextFiles = this.discoverContextFiles();

    // Step 2 — CFORGE_DEV.md
    if (!this.store.exists("CFORGE_DEV.md")) {
      this.store.write("CFORGE_DEV.md", this.cforgeDevContent(input.repoOwner, input.repoName));
      created.push("CFORGE_DEV.md");
    } else {
      skipped.push("CFORGE_DEV.md");
    }

    // Step 2 — README.md
    if (!this.store.exists("README.md")) {
      this.store.write("README.md", this.readmeContent(input.repoName));
      created.push("README.md");
    } else {
      skipped.push("README.md");
    }

    // Step 2 — IDEA.md (only when user provided answers)
    if (!this.store.exists("IDEA.md")) {
      if (input.ideaAnswers) {
        this.store.write("IDEA.md", this.ideaContent(input.ideaAnswers));
        created.push("IDEA.md");
      } else {
        skipped.push("IDEA.md");
      }
    } else {
      skipped.push("IDEA.md");
    }

    // Step 2 — ARCHITECTURE.md
    if (!this.store.exists("ARCHITECTURE.md")) {
      this.store.write("ARCHITECTURE.md", this.architectureContent(input.repoName));
      created.push("ARCHITECTURE.md");
    } else {
      skipped.push("ARCHITECTURE.md");
    }

    // Step 3 — Scaffold docs/ if requested
    if (input.scaffoldDocs) {
      if (!this.store.exists("docs/decisions")) {
        this.store.ensureDir("docs/decisions");
        this.store.write(
          "docs/decisions/0001-record-architecture-decisions.md",
          this.adrTemplate(),
        );
        created.push("docs/decisions/");
      }

      if (!this.store.exists("docs/scenarios")) {
        this.store.ensureDir("docs/scenarios");
        this.store.write("docs/scenarios/example-scenario.md", this.sceTemplate());
        created.push("docs/scenarios/");
      }
    }

    return { created, skipped, discoveredContextFiles };
  }

  // ---------------------------------------------------------------------------
  // Private helpers — discovery
  // ---------------------------------------------------------------------------

  private discoverContextFiles(): string[] {
    const discovered: string[] = [];
    for (const file of CONTEXT_FILE_ORDER) {
      if (this.store.exists(file)) {
        discovered.push(file);
      }
    }
    const docsFiles = this.store.glob("docs/**/*.md");
    discovered.push(...docsFiles);
    return discovered;
  }

  // ---------------------------------------------------------------------------
  // Private helpers — content generators
  // ---------------------------------------------------------------------------

  private cforgeDevContent(owner?: string, repo?: string): string {
    const ownerLine = owner ?? "<org>";
    const repoLine = repo ?? "<repo-name>";
    return (
      `# CFORGE_DEV.md\n` +
      `## Repository\n` +
      `owner: ${ownerLine}\n` +
      `repo: ${repoLine}\n` +
      `## Context files\n` +
      `# List any non-standard files to include\n`
    );
  }

  private readmeContent(repoName?: string): string {
    const name = repoName ?? "My Project";
    return (
      `# ${name}\n\n` +
      `> TODO: Add project description.\n\n` +
      `## Getting Started\n\n` +
      `TODO: Add setup instructions.\n`
    );
  }

  private ideaContent(answers: IdeaAnswers): string {
    return (
      `# IDEA.md\n\n` +
      `## What problem does this solve?\n\n` +
      `${answers.problem}\n\n` +
      `## Who is it for?\n\n` +
      `${answers.audience}\n\n` +
      `## What makes it different?\n\n` +
      `${answers.differentiator}\n`
    );
  }

  private architectureContent(repoName?: string): string {
    const name = repoName ?? "this project";
    return (
      `# Architecture\n\n` +
      `## Overview\n\n` +
      `TODO: Describe the architecture of ${name}.\n\n` +
      `## Layers\n\n` +
      `TODO: Document architectural layers and dependencies.\n`
    );
  }

  private adrTemplate(): string {
    return (
      `# ADR-0001: Record Architecture Decisions\n\n` +
      `## Status\n\nAccepted\n\n` +
      `## Context\n\nWe need to record the architectural decisions made on this project.\n\n` +
      `## Decision\n\nWe will use Architecture Decision Records (ADRs) to capture significant decisions.\n\n` +
      `## Consequences\n\nA log of architectural decisions will be maintained.\n`
    );
  }

  private sceTemplate(): string {
    return (
      `# Scenario: Example\n\n` +
      `## Context\n\nDescribe the scenario context.\n\n` +
      `## Given\n\n- Initial conditions\n\n` +
      `## When\n\n- Triggering event\n\n` +
      `## Then\n\n- Expected outcomes\n`
    );
  }
}
