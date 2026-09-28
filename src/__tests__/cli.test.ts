import { describe, expect, it } from "bun:test";
import { createCli } from "../cli.js";

describe("CLI", () => {
  it("creates CLI program with correct name and commands", () => {
    const program = createCli();
    expect(program.name()).toBe("claude-workspace");
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain("hook");
    expect(commands).toContain("workspace");

    const hookCmd = program.commands.find((c) => c.name() === "hook");
    const hookSubcommands = hookCmd?.commands.map((c) => c.name());
    expect(hookSubcommands).toContain("session-start");

    const workspaceCmd = program.commands.find((c) => c.name() === "workspace");
    const workspaceSubcommands = workspaceCmd?.commands.map((c) => c.name());
    expect(workspaceSubcommands).toContain("inspect");
    expect(workspaceSubcommands).toContain("list");
  });

  it("formats help screen with hierarchical tree", () => {
    const program = createCli();
    const helpInformation = program.helpInformation();
    expect(helpInformation).toContain("claude-workspace");
    expect(helpInformation).toContain("hook");
    expect(helpInformation).toContain("workspace");
  });
});
