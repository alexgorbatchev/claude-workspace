import process from "node:process";
import { formatSessionAdditionalContext, formatWorkspaceReport } from "./formatters.js";
import type { ISessionStartHookInput, ISessionStartHookOutput, IWorkspaceReportDetails } from "./types.js";
import {
  loadGitWorkspaceConfig,
  resolveMatchedWorkspaceLayers,
  type IWorkspaceResolverOptions,
} from "./workspaceResolver.js";

export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  return new Promise((resolve) => {
    let data = "";
    let isDone = false;

    const complete = (result: string): void => {
      if (!isDone) {
        isDone = true;
        resolve(result);
      }
    };

    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      complete(data);
    });
    process.stdin.on("error", () => {
      complete(data);
    });

    // Safety timeout in case stdin remains open without EOF
    setTimeout(() => {
      complete(data);
    }, 200);
  });
}

export interface IHandleSessionStartOptions {
  readonly cwd?: string | undefined;
  readonly resolverOptions?: IWorkspaceResolverOptions | undefined;
}

export async function handleSessionStart(options: IHandleSessionStartOptions = {}): Promise<ISessionStartHookOutput> {
  let stdinInput: ISessionStartHookInput | undefined;
  try {
    const rawStdin = await readStdin();
    if (rawStdin.trim().length > 0) {
      stdinInput = JSON.parse(rawStdin.trim()) as ISessionStartHookInput;
    }
  } catch {
    // Ignore malformed stdin
  }

  const targetCwd = options.cwd ?? stdinInput?.cwd ?? process.cwd();
  const gitConfig = loadGitWorkspaceConfig(targetCwd, options.resolverOptions);
  const layers = resolveMatchedWorkspaceLayers(targetCwd, options.resolverOptions);

  if (layers.length === 0) {
    return {};
  }

  const details: IWorkspaceReportDetails = {
    cwd: targetCwd,
    ...(gitConfig?.gitConfigValue !== undefined ? { gitConfigValue: gitConfig.gitConfigValue } : {}),
    configs: layers,
  };

  const systemMessage = `\n\n${formatWorkspaceReport(details)}`;
  const additionalContext = formatSessionAdditionalContext(layers);

  return {
    systemMessage,
    ...(additionalContext.length > 0
      ? {
          hookSpecificOutput: {
            hookEventName: "SessionStart" as const,
            additionalContext,
          },
        }
      : {}),
  };
}
