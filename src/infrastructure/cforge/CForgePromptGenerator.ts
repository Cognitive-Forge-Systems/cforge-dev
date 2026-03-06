import { PromptGenerator } from "../../domain/interfaces/PromptGenerator";
import { Issue } from "../../domain/models/Issue";
import { ProjectContext } from "../../domain/models/ProjectContext";
import { SPRINT_PLANNING_SYSTEM_PROMPT } from "../../domain/engines/SprintPlanningPrompt";

const DEFAULT_MODEL = "openai/gpt-4o";
const MAX_TOKENS = 1500;

export class CForgePromptGenerator implements PromptGenerator {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(model?: string) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error("OPENROUTER_API_KEY not set");
    }
    this.apiKey = key;
    this.model = model ?? DEFAULT_MODEL;
  }

  async generateImplementationPrompt(issue: Issue, context: ProjectContext): Promise<string> {
    const systemPrompt = `You are an expert software engineer. Generate a precise Claude Code implementation prompt for the given issue.

Project context:
- Stack: ${context.stack}
- Architecture: ${context.architecture}
- Rules: ${context.rules.join(", ") || "none"}
- Existing modules: ${context.existingModules.map((m) => `${m.name}: ${m.description}`).join(", ") || "none"}

The prompt you generate should be detailed enough for Claude Code to implement the issue in a single session, following TDD-first principles.`;

    const userMessage = `Generate a Claude Code implementation prompt for this issue:

Title: ${issue.title}
Body: ${issue.body}`;

    return this.callOpenRouter(systemPrompt, userMessage);
  }

  async generatePlanningPrompt(prd: string, context: ProjectContext): Promise<string> {
    const systemPrompt = `${SPRINT_PLANNING_SYSTEM_PROMPT}

Project context:
- Stack: ${context.stack}
- Architecture: ${context.architecture}
- Rules: ${context.rules.join(", ") || "none"}
- Existing modules: ${context.existingModules.map((m) => `${m.name}: ${m.description}`).join(", ") || "none"}`;

    return this.callOpenRouter(systemPrompt, prd);
  }

  private async callOpenRouter(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
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
}
