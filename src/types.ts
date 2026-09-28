export type FileExistsFn = (filePath: string) => boolean;
export type FileReaderFn = (filePath: string) => string;
export type DirectoryReaderFn = (dirPath: string) => string[];
export type GitConfigReaderFn = (repoRoot: string) => string[];

export type WorkspaceRuleLoad = string | readonly string[];

export interface IWorkspaceRule {
  readonly when: string;
  readonly load: WorkspaceRuleLoad;
}

export type LegacyWorkspaceMappings = Record<string, WorkspaceRuleLoad>;

export interface IWorkspaceConfig {
  readonly configs?: readonly IWorkspaceRule[] | undefined;
  readonly workspaces?: LegacyWorkspaceMappings | undefined;
  readonly gitConfigValue?: string | readonly string[] | undefined;
}

export interface ISkillMetadata {
  readonly name: string;
  readonly description: string;
  readonly path: string;
}

export interface IParsedSkillFrontmatter {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
}

export interface IWorkspaceMatchedLayer {
  readonly when: string;
  readonly load: string;
  readonly promptFileName?: string | undefined;
  readonly promptContent?: string | undefined;
  readonly skills: ISkillMetadata[];
  readonly promptNames: string[];
}

export interface IWorkspaceReportDetails {
  readonly cwd: string;
  readonly gitConfigValue?: string | readonly string[] | undefined;
  readonly configs: IWorkspaceMatchedLayer[];
}

export interface ISessionStartHookInput {
  readonly session_id?: string | undefined;
  readonly cwd?: string | undefined;
  readonly source?: "startup" | "resume" | "clear" | "compact" | "fork" | string | undefined;
  readonly model?: string | undefined;
  readonly agent_type?: string | undefined;
}

export interface ISessionStartHookOutput {
  readonly systemMessage?: string | undefined;
  readonly hookSpecificOutput?:
    | {
        readonly hookEventName: "SessionStart";
        readonly additionalContext: string;
      }
    | undefined;
}
