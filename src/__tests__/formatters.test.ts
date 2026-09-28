import { describe, expect, it } from "bun:test";
import { formatSessionAdditionalContext, formatWorkspaceReport } from "../formatters.js";
import type { IWorkspaceMatchedLayer, IWorkspaceReportDetails } from "../types.js";

describe("formatters", () => {
  const sampleLayers: IWorkspaceMatchedLayer[] = [
    {
      when: "~/dev/*",
      load: "/home/alice/.ai/common",
      promptFileName: "APPEND_SYSTEM.md",
      promptContent: "Shared organization guidelines",
      skills: [
        {
          name: "org-helper",
          description: "Helper for organization standards",
          path: "/home/alice/.ai/common/skills/org-helper/SKILL.md",
        },
      ],
      promptNames: [],
    },
    {
      when: "~/dev/*",
      load: "/home/alice/.ai/my-app",
      promptFileName: "APPEND_SYSTEM.md",
      promptContent: "Project-specific rules",
      skills: [],
      promptNames: [],
    },
  ];

  describe("formatWorkspaceReport", () => {
    it("formats human-mode report", () => {
      const details: IWorkspaceReportDetails = {
        cwd: "/home/alice/dev/my-app",
        gitConfigValue: "/home/alice/workspace.json",
        configs: sampleLayers,
      };

      const report = formatWorkspaceReport(details, false, "/home/alice");
      expect(report).toContain("[@alexgorbatchev/claude-workspace]");
      expect(report).toContain("git: ~/workspace.json");
      expect(report).toContain("cwd: ~/dev/my-app");
      expect(report).toContain("load: ~/.ai/common");
      expect(report).toContain("skills:");
      expect(report).toContain("- org-helper");
      expect(report).toContain("load: ~/.ai/my-app");
    });

    it("formats multi-value git configs as bullet points", () => {
      const details: IWorkspaceReportDetails = {
        cwd: "/home/alice/dev/my-app",
        gitConfigValue: ["/home/alice/.ai/common", "/home/alice/.ai/my-app"],
        configs: sampleLayers,
      };

      const report = formatWorkspaceReport(details, false, "/home/alice");
      expect(report).toContain("git:\n    - ~/.ai/common\n    - ~/.ai/my-app");
    });

    it("formats agent-mode report", () => {
      const details: IWorkspaceReportDetails = {
        cwd: "/home/alice/dev/my-app",
        gitConfigValue: "/home/alice/workspace.json",
        configs: sampleLayers,
      };

      const report = formatWorkspaceReport(details, true, "/home/alice");
      expect(report).toContain("cwd: ~/dev/my-app");
      expect(report).toContain("git: ~/workspace.json");
      expect(report).toContain("* config: when=~/dev/* load=~/.ai/common");
    });
  });

  describe("formatSessionAdditionalContext", () => {
    it("formats instructions and skills into markdown", () => {
      const context = formatSessionAdditionalContext(sampleLayers, "/home/alice");
      expect(context).toContain("# Workspace Instructions: ~/.ai/common");
      expect(context).toContain("Shared organization guidelines");
      expect(context).toContain("# Workspace Instructions: ~/.ai/my-app");
      expect(context).toContain("Project-specific rules");
      expect(context).toContain("## Out-of-Tree Workspace Skills");
      expect(context).toContain(
        "- **org-helper**: Helper for organization standards (`/home/alice/.ai/common/skills/org-helper/SKILL.md`)",
      );
    });
  });
});
