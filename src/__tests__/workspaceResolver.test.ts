import { describe, expect, it } from "bun:test";
import {
  collapseHomeDirectory,
  expandHomeDirectory,
  interpolatePathPlaceholders,
  matchWorkspacePatternWithCaptures,
  parseGitConfigLoads,
  parseSkillFrontmatter,
  parseWorkspaceConfig,
  resolveMatchedWorkspaceLayers,
} from "../workspaceResolver.js";

describe("workspaceResolver", () => {
  describe("expandHomeDirectory / collapseHomeDirectory", () => {
    it("expands ~ to home directory", () => {
      expect(expandHomeDirectory("~", "/Users/alice")).toBe("/Users/alice");
      expect(expandHomeDirectory("~/foo/bar", "/Users/alice")).toBe("/Users/alice/foo/bar");
      expect(expandHomeDirectory("/var/log", "/Users/alice")).toBe("/var/log");
    });

    it("collapses home directory to ~", () => {
      expect(collapseHomeDirectory("/Users/alice", "/Users/alice")).toBe("~");
      expect(collapseHomeDirectory("/Users/alice/foo/bar", "/Users/alice")).toBe("~/foo/bar");
      expect(collapseHomeDirectory("/var/log", "/Users/alice")).toBe("/var/log");
    });
  });

  describe("parseWorkspaceConfig", () => {
    it("parses rule array directly", () => {
      const parsed = parseWorkspaceConfig([{ when: "~/repo/*", load: "~/.workspaces/:1" }]);
      expect(parsed?.configs).toHaveLength(1);
      expect(parsed?.configs?.[0]?.when).toBe("~/repo/*");
      expect(parsed?.configs?.[0]?.load).toBe("~/.workspaces/:1");
    });

    it("parses claude-workspace namespaced config", () => {
      const parsed = parseWorkspaceConfig({
        "@alexgorbatchev/claude-workspace": {
          configs: [{ when: "~/dev/*", load: ["~/.ai/common", "~/.ai/[project]"] }],
        },
      });
      expect(parsed?.configs).toHaveLength(1);
      expect(parsed?.configs?.[0]?.load).toEqual(["~/.ai/common", "~/.ai/[project]"]);
    });

    it("parses pi-workspace namespaced config as fallback", () => {
      const parsed = parseWorkspaceConfig({
        "@alexgorbatchev/pi-workspace": {
          configs: [{ when: "~/dev/*", load: "~/.ai/common" }],
        },
      });
      expect(parsed?.configs).toHaveLength(1);
      expect(parsed?.configs?.[0]?.load).toBe("~/.ai/common");
    });

    it("parses legacy workspaces mapping", () => {
      const parsed = parseWorkspaceConfig({
        workspaces: {
          "~/dev/app": "~/.ai/app",
        },
      });
      expect(parsed?.configs).toHaveLength(1);
      expect(parsed?.configs?.[0]?.when).toBe("~/dev/app");
      expect(parsed?.configs?.[0]?.load).toBe("~/.ai/app");
    });
  });

  describe("matchWorkspacePatternWithCaptures", () => {
    it("matches exact paths", () => {
      const result = matchWorkspacePatternWithCaptures("~/development/repo", "~/development/repo", "/Users/alice");
      expect(result.isMatch).toBe(true);
      expect(result.projectName).toBe("repo");
    });

    it("matches single wildcard and extracts capture", () => {
      const result = matchWorkspacePatternWithCaptures("~/development/*", "~/development/auth-service", "/Users/alice");
      expect(result.isMatch).toBe(true);
      expect(result.captures).toEqual(["auth-service"]);
      expect(result.projectName).toBe("auth-service");
    });

    it("matches double wildcard recursively", () => {
      const result = matchWorkspacePatternWithCaptures(
        "~/development/**",
        "~/development/company/sub/repo",
        "/Users/alice",
      );
      expect(result.isMatch).toBe(true);
      expect(result.projectName).toBe("repo");
    });

    it("rejects non-matching paths", () => {
      const result = matchWorkspacePatternWithCaptures("~/development/*", "~/other/auth-service", "/Users/alice");
      expect(result.isMatch).toBe(false);
    });
  });

  describe("interpolatePathPlaceholders", () => {
    it("interpolates [project] and :project", () => {
      expect(interpolatePathPlaceholders("~/.ai/[project]", "auth-service")).toBe("~/.ai/auth-service");
      expect(interpolatePathPlaceholders("~/.ai/:project", "auth-service")).toBe("~/.ai/auth-service");
      expect(interpolatePathPlaceholders("~/.ai/[name]", "auth-service")).toBe("~/.ai/auth-service");
    });

    it("interpolates captures :1 and $1", () => {
      expect(interpolatePathPlaceholders("~/.ai/:1", undefined, ["auth-service"])).toBe("~/.ai/auth-service");
      expect(interpolatePathPlaceholders("~/.ai/$1", undefined, ["auth-service"])).toBe("~/.ai/auth-service");
    });
  });

  describe("parseGitConfigLoads", () => {
    it("parses [claude-workspace] load and config values", () => {
      const content = [
        "[core]",
        "\tbare = false",
        "[claude-workspace]",
        "\tload = ~/.ai/common, ~/.ai/proj",
        "\tconfig = ~/workspace.json",
      ].join("\n");
      const loads = parseGitConfigLoads(content);
      expect(loads).toEqual(["~/workspace.json"]);
    });

    it("parses [workspace] section as fallback", () => {
      const content = ["[workspace]", "\tload = ~/.ai/common"].join("\n");
      const loads = parseGitConfigLoads(content);
      expect(loads).toEqual(["~/.ai/common"]);
    });

    it("parses [pi-workspace] section as fallback", () => {
      const content = ["[pi-workspace]", "\tload = ~/.ai/common", "\tload = ~/.ai/proj"].join("\n");
      const loads = parseGitConfigLoads(content);
      expect(loads).toEqual(["~/.ai/common", "~/.ai/proj"]);
    });

    it("ignores comments and quoted lines", () => {
      const content = [
        "[claude-workspace]",
        "\t# This is a comment",
        '\tload = "/path/with spaces/a" ; inline comment',
        "\tload = '/path/with spaces/b'",
      ].join("\n");
      const loads = parseGitConfigLoads(content);
      expect(loads).toEqual(["/path/with spaces/a", "/path/with spaces/b"]);
    });
  });

  describe("parseSkillFrontmatter", () => {
    it("parses single line name and description", () => {
      const content = ["---", "name: my-skill", "description: A helpful skill", "---", "# Content"].join("\n");
      expect(parseSkillFrontmatter(content)).toEqual({
        name: "my-skill",
        description: "A helpful skill",
      });
    });

    it("parses multiline block scalar description", () => {
      const content = [
        "---",
        "name: multiline-skill",
        "description: >-",
        "  Line one of the skill.",
        "  Line two of the skill.",
        "author: alex",
        "---",
      ].join("\n");
      expect(parseSkillFrontmatter(content)).toEqual({
        name: "multiline-skill",
        description: "Line one of the skill. Line two of the skill.",
      });
    });
  });

  describe("resolveMatchedWorkspaceLayers", () => {
    it("resolves layers with virtual filesystem", () => {
      const mockFiles = new Map<string, string>([
        ["/home/alice/dev/proj/.git", "ref: refs/heads/main"],
        ["/home/alice/.ai/common/APPEND_SYSTEM.md", "Common instructions"],
        ["/home/alice/.ai/common/skills/test-skill/SKILL.md", "---\nname: test-skill\ndescription: Test\n---"],
        ["/home/alice/.ai/proj/APPEND_SYSTEM.md", "Project instructions"],
      ]);

      const mockDirs = new Map<string, string[]>([
        ["/home/alice/.ai/common", ["APPEND_SYSTEM.md", "skills"]],
        ["/home/alice/.ai/common/skills", ["test-skill"]],
        ["/home/alice/.ai/common/skills/test-skill", ["SKILL.md"]],
        ["/home/alice/.ai/common/prompts", []],
        ["/home/alice/.ai/proj", ["APPEND_SYSTEM.md"]],
        ["/home/alice/.ai/proj/skills", []],
        ["/home/alice/.ai/proj/prompts", []],
      ]);

      const layers = resolveMatchedWorkspaceLayers("/home/alice/dev/proj", {
        homeDirectoryPath: "/home/alice",
        config: {
          configs: [
            {
              when: "~/dev/*",
              load: ["~/.ai/common", "~/.ai/[project]"],
            },
          ],
        },
        fileExists: (p) => mockFiles.has(p) || mockDirs.has(p),
        fileReader: (p) => mockFiles.get(p) ?? "",
        directoryReader: (p) => mockDirs.get(p) ?? [],
      });

      expect(layers).toHaveLength(2);
      expect(layers[0]?.load).toBe("/home/alice/.ai/common");
      expect(layers[0]?.promptFileName).toBe("APPEND_SYSTEM.md");
      expect(layers[0]?.promptContent).toBe("Common instructions");
      expect(layers[0]?.skills).toHaveLength(1);
      expect(layers[0]?.skills[0]?.name).toBe("test-skill");

      expect(layers[1]?.load).toBe("/home/alice/.ai/proj");
      expect(layers[1]?.promptContent).toBe("Project instructions");
    });
  });
});
