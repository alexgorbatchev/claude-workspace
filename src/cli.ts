import { Command } from "commander";
import process from "node:process";
import { resolve } from "node:path";
import { formatWorkspaceReport, isAgentMode } from "./formatters.js";
import { formatCommandTree } from "./helpTree.js";
import { handleSessionStart } from "./hookHandler.js";
import type { IWorkspaceReportDetails } from "./types.js";
import { collapseHomeDirectory, loadGitWorkspaceConfig, resolveMatchedWorkspaceLayers } from "./workspaceResolver.js";

export interface IHookSessionStartCliOptions {
  readonly cwd?: string | undefined;
}

export function createCli(): Command {
  const program = new Command();

  program.name("claude-workspace").description("Hierarchical out-of-tree workspaces for Claude Code").version("1.0.0");

  // Configure hierarchical tree help screen
  program.configureHelp({
    formatHelp(cmd, helper) {
      const isAgent = isAgentMode();
      const tree = formatCommandTree(cmd);

      const visibleOptions = helper.visibleOptions(cmd);
      let optionsText = "";
      if (visibleOptions.length > 0) {
        const optionLines: string[] = ["Options:"];
        const maxTermLength = helper.longestOptionTermLength(cmd, helper);
        for (const opt of visibleOptions) {
          const term = helper.optionTerm(opt);
          const desc = helper.optionDescription(opt);
          const padding = " ".repeat(Math.max(2, maxTermLength - term.length + 4));
          optionLines.push(`  ${term}${padding}${desc}`);
        }
        optionsText = optionLines.join("\n");
      }

      if (isAgent) {
        return `${cmd.name()} - ${cmd.description()}\n${tree}\n${optionsText}`.trim();
      }

      const header = `${cmd.name()} v1.0.0\n${cmd.description()}\n\nUsage: ${helper.commandUsage(cmd)}`;
      const sections = [header];
      if (tree.length > 0) {
        sections.push(tree);
      }
      if (optionsText.length > 0) {
        sections.push(optionsText);
      }
      return sections.join("\n\n") + "\n";
    },
  });

  // Subject: hook
  const hookCommand = program.command("hook").description("Lifecycle hooks for Claude Code");

  hookCommand
    .command("session-start")
    .description("Execute Claude Code SessionStart lifecycle hook")
    .option("-c, --cwd <path>", "Target working directory")
    .action(async (options: IHookSessionStartCliOptions) => {
      const output = await handleSessionStart({
        cwd: options.cwd ? resolve(options.cwd) : undefined,
      });
      // In hook mode, always emit valid JSON on stdout for Claude Code
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    });

  // Subject: workspace
  const workspaceCommand = program.command("workspace").description("Inspect and manage workspaces");

  workspaceCommand
    .command("inspect [path]")
    .description("Inspect resolved workspace layers for a directory")
    .action((targetPathArg?: string) => {
      const targetPath = targetPathArg ? resolve(targetPathArg) : process.cwd();
      const gitConfig = loadGitWorkspaceConfig(targetPath);
      const layers = resolveMatchedWorkspaceLayers(targetPath);

      if (layers.length === 0) {
        if (isAgentMode()) {
          console.log(`ERR: no workspace matched for ${collapseHomeDirectory(targetPath)}`);
        } else {
          console.log(`No workspace configuration matched for ${collapseHomeDirectory(targetPath)}`);
        }
        return;
      }

      const details: IWorkspaceReportDetails = {
        cwd: targetPath,
        ...(gitConfig?.gitConfigValue !== undefined ? { gitConfigValue: gitConfig.gitConfigValue } : {}),
        configs: layers,
      };

      console.log(formatWorkspaceReport(details));
    });

  workspaceCommand
    .command("list [path]")
    .description("List configured workspace rules and Git config values")
    .action((targetPathArg?: string) => {
      const targetPath = targetPathArg ? resolve(targetPathArg) : process.cwd();
      const gitConfig = loadGitWorkspaceConfig(targetPath);
      const isAgent = isAgentMode();

      if (!gitConfig) {
        if (isAgent) {
          console.log(`ERR: no workspace configuration found in git for ${collapseHomeDirectory(targetPath)}`);
        } else {
          console.log(`No workspace configuration found in git for ${collapseHomeDirectory(targetPath)}`);
        }
        return;
      }

      if (isAgent) {
        console.log(`gitConfigValue: ${JSON.stringify(gitConfig.gitConfigValue)}`);
        if (gitConfig.configs) {
          for (const rule of gitConfig.configs) {
            console.log(`* rule: when=${rule.when} load=${JSON.stringify(rule.load)}`);
          }
        }
      } else {
        console.log(`Git Config Value:`);
        if (Array.isArray(gitConfig.gitConfigValue)) {
          for (const val of gitConfig.gitConfigValue) {
            console.log(`  - ${collapseHomeDirectory(val)}`);
          }
        } else if (typeof gitConfig.gitConfigValue === "string") {
          console.log(`  ${collapseHomeDirectory(gitConfig.gitConfigValue)}`);
        }

        if (gitConfig.configs && gitConfig.configs.length > 0) {
          console.log(`\nConfigured Rules:`);
          for (const rule of gitConfig.configs) {
            console.log(`  when: ${collapseHomeDirectory(rule.when)}`);
            if (Array.isArray(rule.load)) {
              console.log("  load:");
              for (const l of rule.load) {
                console.log(`    - ${collapseHomeDirectory(l)}`);
              }
            } else if (typeof rule.load === "string") {
              console.log(`  load: ${collapseHomeDirectory(rule.load)}`);
            }
          }
        }
      }
    });

  return program;
}

export function runCli(argv: string[] = process.argv): void {
  const program = createCli();
  program.parse(argv);
}
