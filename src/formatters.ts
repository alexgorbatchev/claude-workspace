import process from "node:process";
import type { IWorkspaceMatchedLayer, IWorkspaceReportDetails } from "./types.js";
import { collapseHomeDirectory } from "./workspaceResolver.js";

export function isAgentMode(): boolean {
  const agent = process.env.AGENT?.trim().toLowerCase();
  return agent === "1" || agent === "true" || agent === "yes";
}

export function formatWorkspaceReport(
  details: IWorkspaceReportDetails,
  isAgent: boolean = isAgentMode(),
  homeDirectoryPath?: string,
): string {
  const collapsedCwd = collapseHomeDirectory(details.cwd, homeDirectoryPath);

  if (isAgent) {
    const lines: string[] = [`cwd: ${collapsedCwd}`];

    if (details.gitConfigValue !== undefined) {
      if (Array.isArray(details.gitConfigValue)) {
        for (const item of details.gitConfigValue) {
          lines.push(`git: ${collapseHomeDirectory(item, homeDirectoryPath)}`);
        }
      } else if (typeof details.gitConfigValue === "string") {
        lines.push(`git: ${collapseHomeDirectory(details.gitConfigValue, homeDirectoryPath)}`);
      }
    }

    for (const config of details.configs) {
      const parts: string[] = [
        `when=${collapseHomeDirectory(config.when, homeDirectoryPath)}`,
        `load=${collapseHomeDirectory(config.load, homeDirectoryPath)}`,
      ];
      if (config.promptFileName) {
        parts.push(`prompt=${config.promptFileName}`);
      }
      if (config.skills.length > 0) {
        parts.push(`skills=${config.skills.map((s) => s.name).join(",")}`);
      }
      if (config.promptNames.length > 0) {
        parts.push(`prompts=${config.promptNames.join(",")}`);
      }
      lines.push(`* config: ${parts.join(" ")}`);
    }

    return lines.join("\n");
  }

  // Human mode
  const lines: string[] = ["[@alexgorbatchev/claude-workspace]"];

  if (details.gitConfigValue !== undefined) {
    if (Array.isArray(details.gitConfigValue)) {
      if (details.gitConfigValue.length === 1 && details.gitConfigValue[0] !== undefined) {
        lines.push(`  git: ${collapseHomeDirectory(details.gitConfigValue[0], homeDirectoryPath)}`);
      } else {
        lines.push("  git:");
        for (const item of details.gitConfigValue) {
          lines.push(`    - ${collapseHomeDirectory(item, homeDirectoryPath)}`);
        }
      }
    } else if (typeof details.gitConfigValue === "string") {
      lines.push(`  git: ${collapseHomeDirectory(details.gitConfigValue, homeDirectoryPath)}`);
    }
  }

  lines.push(`  cwd: ${collapsedCwd}`);

  for (const config of details.configs) {
    lines.push("  config:");
    lines.push(`    when: ${collapseHomeDirectory(config.when, homeDirectoryPath)}`);
    lines.push(`    load: ${collapseHomeDirectory(config.load, homeDirectoryPath)}`);
    if (config.promptFileName) {
      lines.push(`    prompt: ${config.promptFileName}`);
    }
    if (config.skills.length > 0) {
      lines.push("    skills:");
      for (const skill of config.skills) {
        lines.push(`      - ${skill.name}`);
      }
    }
    if (config.promptNames.length > 0) {
      lines.push("    prompts:");
      for (const promptName of config.promptNames) {
        lines.push(`      - ${promptName}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatSessionAdditionalContext(
  layers: readonly IWorkspaceMatchedLayer[],
  homeDirectoryPath?: string,
): string {
  const sections: string[] = [];

  for (const layer of layers) {
    if (layer.promptContent && layer.promptContent.trim().length > 0) {
      const header = `# Workspace Instructions: ${collapseHomeDirectory(layer.load, homeDirectoryPath)}`;
      sections.push(`${header}\n\n${layer.promptContent.trim()}`);
    }
  }

  const allSkills = layers.flatMap((l) => l.skills);
  if (allSkills.length > 0) {
    const skillListLines: string[] = [
      "## Out-of-Tree Workspace Skills",
      "The following project skills are available in this workspace:",
    ];
    for (const skill of allSkills) {
      skillListLines.push(`- **${skill.name}**: ${skill.description} (\`${skill.path}\`)`);
    }
    skillListLines.push(
      "\nWhen you need to use one of these skills, read its SKILL.md file for instructions and execute any bundled scripts or references.",
    );
    sections.push(skillListLines.join("\n"));
  }

  return sections.join("\n\n---\n\n");
}
