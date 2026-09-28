import type { Command } from "commander";
import process from "node:process";
import { isAgentMode } from "./formatters.js";

export function getTerminalWidth(fallback = 80): number {
  return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : fallback;
}

export function formatCommandTree(rootCommand: Command): string {
  const terminalWidth = getTerminalWidth();
  const isAgent = isAgentMode();

  if (isAgent) {
    // Agent-facing token-conservative commands list
    const lines: string[] = [`commands: ${rootCommand.name()}`];
    const walk = (cmd: Command, prefix: string): void => {
      for (const sub of cmd.commands) {
        lines.push(`${prefix}* ${sub.name()}: ${sub.description()}`);
        walk(sub, `${prefix}  `);
      }
    };
    walk(rootCommand, "  ");
    return lines.join("\n");
  }

  // Human mode hierarchical tree
  interface IFlatTreeItem {
    readonly label: string;
    readonly description: string;
    readonly isGroup: boolean;
    readonly prefix: string;
  }

  const items: IFlatTreeItem[] = [];

  const collect = (cmd: Command, prefix: string, isLastInParent: boolean, isRoot: boolean): void => {
    const subcommands = cmd.commands;
    if (isRoot) {
      subcommands.forEach((child, index) => {
        const isLast = index === subcommands.length - 1;
        collect(child, "", isLast, false);
      });
      return;
    }

    const marker = isLastInParent ? "╰─ " : "├─ ";
    const continuation = isLastInParent ? "    " : "│   ";
    const hasChildren = subcommands.length > 0;

    items.push({
      label: hasChildren ? cmd.name() : `${cmd.name()} ${cmd.usage()}`.trim(),
      description: cmd.description(),
      isGroup: hasChildren,
      prefix: `${prefix}${marker}`,
    });

    if (hasChildren) {
      subcommands.forEach((child, index) => {
        const isLast = index === subcommands.length - 1;
        collect(child, `${prefix}${continuation}`, isLast, false);
      });
    }
  };

  collect(rootCommand, " ", false, true);

  if (items.length === 0) {
    return "";
  }

  let maxBranchLength = 0;
  for (const item of items) {
    const branch = `${item.prefix}${item.label}`;
    if (!item.isGroup && branch.length > maxBranchLength) {
      maxBranchLength = branch.length;
    }
  }

  const paddedWidth = Math.min(maxBranchLength + 4, 40);
  const formattedLines: string[] = ["Commands:"];

  for (const item of items) {
    const branch = `${item.prefix}${item.label}`;
    if (item.isGroup || item.description.length === 0) {
      formattedLines.push(branch);
    } else {
      const padding = " ".repeat(Math.max(1, paddedWidth - branch.length));
      const fullLine = `${branch}${padding}${item.description}`;
      if (fullLine.length > terminalWidth && terminalWidth > 10) {
        formattedLines.push(`${fullLine.slice(0, terminalWidth - 3)}...`);
      } else {
        formattedLines.push(fullLine);
      }
    }
  }

  return formattedLines.join("\n");
}
