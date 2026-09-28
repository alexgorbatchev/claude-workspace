import { describe, expect, it } from "bun:test";
import { handleSessionStart } from "../hookHandler.js";

describe("hookHandler", () => {
  it("returns empty object when no workspaces match", async () => {
    const output = await handleSessionStart({
      cwd: "/nonexistent/directory",
      resolverOptions: {
        config: { configs: [] },
      },
    });

    expect(output).toEqual({});
  });

  it("returns systemMessage and hookSpecificOutput when layers match", async () => {
    const mockFiles = new Map<string, string>([["/home/alice/.ai/common/APPEND_SYSTEM.md", "Organization standards"]]);
    const mockDirs = new Map<string, string[]>([["/home/alice/.ai/common", ["APPEND_SYSTEM.md"]]]);

    const output = await handleSessionStart({
      cwd: "/home/alice/dev/my-app",
      resolverOptions: {
        homeDirectoryPath: "/home/alice",
        config: {
          configs: [
            {
              when: "~/dev/*",
              load: "/home/alice/.ai/common",
            },
          ],
        },
        fileExists: (p) => mockFiles.has(p) || mockDirs.has(p),
        fileReader: (p) => mockFiles.get(p) ?? "",
        directoryReader: (p) => mockDirs.get(p) ?? [],
      },
    });

    expect(output.systemMessage).toBeDefined();
    expect(output.systemMessage).toContain("/home/alice/.ai/common");
    expect(output.hookSpecificOutput).toBeDefined();
    expect(output.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(output.hookSpecificOutput?.additionalContext).toContain("Organization standards");
  });
});
