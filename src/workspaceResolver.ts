import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import type {
  DirectoryReaderFn,
  FileExistsFn,
  FileReaderFn,
  GitConfigReaderFn,
  IParsedSkillFrontmatter,
  ISkillMetadata,
  IWorkspaceConfig,
  IWorkspaceMatchedLayer,
  IWorkspaceRule,
  WorkspaceRuleLoad,
} from "./types.js";

export const CLAUDE_WORKSPACE_CONFIG_KEY = "@alexgorbatchev/claude-workspace";
export const PI_WORKSPACE_CONFIG_KEY = "@alexgorbatchev/pi-workspace";

export const GIT_CONFIG_KEYS = [
  "claude-workspace.config",
  "claude-workspace.load",
  "claude-workspace.path",
  "workspace.config",
  "workspace.load",
  "workspace.path",
  "pi-workspace.config",
  "pi-workspace.load",
  "pi-workspace.path",
] as const;

export const PROMPT_FILE_NAMES = ["APPEND_SYSTEM.md", "SYSTEM.md", "AGENTS.md", "CLAUDE.md"] as const;

export interface IWorkspaceResolverOptions {
  readonly config?: IWorkspaceConfig | undefined;
  readonly homeDirectoryPath?: string | undefined;
  readonly fileExists?: FileExistsFn | undefined;
  readonly directoryReader?: DirectoryReaderFn | undefined;
  readonly fileReader?: FileReaderFn | undefined;
  readonly gitConfigReader?: GitConfigReaderFn | undefined;
}

export function expandHomeDirectory(filePath: string, homeDirectoryPath: string = homedir()): string {
  if (filePath === "~") {
    return homeDirectoryPath;
  }
  if (filePath.startsWith(`~${sep}`) || filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return join(homeDirectoryPath, filePath.slice(2));
  }
  return filePath;
}

export function collapseHomeDirectory(filePath: string, homeDirectoryPath: string = homedir()): string {
  if (filePath === homeDirectoryPath) {
    return "~";
  }
  const prefix = homeDirectoryPath.endsWith(sep) ? homeDirectoryPath : `${homeDirectoryPath}${sep}`;
  if (filePath.startsWith(prefix)) {
    return `~/${filePath.slice(prefix.length).replaceAll("\\", "/")}`;
  }
  return filePath;
}

export function parseRuleLoad(rawLoad: unknown): WorkspaceRuleLoad | undefined {
  if (typeof rawLoad === "string" && rawLoad.trim().length > 0) {
    return rawLoad.trim();
  }
  if (Array.isArray(rawLoad)) {
    const validPaths = rawLoad
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (validPaths.length > 0) {
      return validPaths;
    }
  }
  return undefined;
}

export function parseWorkspaceConfig(settings: unknown): IWorkspaceConfig | undefined {
  if (typeof settings !== "object" || settings === null) {
    return undefined;
  }

  const rawConfig = Array.isArray(settings)
    ? { configs: settings }
    : (Reflect.get(settings, CLAUDE_WORKSPACE_CONFIG_KEY) ??
      Reflect.get(settings, PI_WORKSPACE_CONFIG_KEY) ??
      settings);

  if (typeof rawConfig !== "object" || rawConfig === null) {
    return undefined;
  }

  const rules: IWorkspaceRule[] = [];

  const rawConfigs = Reflect.get(rawConfig, "configs");
  if (Array.isArray(rawConfigs)) {
    for (const entry of rawConfigs) {
      if (typeof entry === "object" && entry !== null) {
        const rawWhen = Reflect.get(entry, "when") ?? Reflect.get(entry, "glob");
        const rawLoad = Reflect.get(entry, "load") ?? Reflect.get(entry, "path");
        if (typeof rawWhen === "string" && rawWhen.trim().length > 0) {
          const parsedLoad = parseRuleLoad(rawLoad);
          if (parsedLoad !== undefined) {
            rules.push({ when: rawWhen.trim(), load: parsedLoad });
          }
        }
      }
    }
  }

  const rawWorkspaces = Reflect.get(rawConfig, "workspaces");
  if (typeof rawWorkspaces === "object" && rawWorkspaces !== null && !Array.isArray(rawWorkspaces)) {
    for (const [when, rawLoad] of Object.entries(rawWorkspaces)) {
      if (typeof when === "string" && when.trim().length > 0) {
        const parsedLoad = parseRuleLoad(rawLoad);
        if (parsedLoad !== undefined) {
          rules.push({ when: when.trim(), load: parsedLoad });
        }
      }
    }
  }

  if (rules.length === 0) {
    return undefined;
  }

  return { configs: rules };
}

function normalizePathSegments(inputPath: string, homeDirectoryPath?: string): string[] {
  const expanded = expandHomeDirectory(inputPath, homeDirectoryPath);
  return expanded
    .split(/[/\\]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export interface IMatchResult {
  readonly isMatch: boolean;
  readonly captures: readonly string[];
  readonly projectName?: string | undefined;
}

export function matchWorkspacePatternWithCaptures(
  pattern: string,
  targetPath: string,
  homeDirectoryPath?: string,
): IMatchResult {
  const patternSegments = normalizePathSegments(pattern, homeDirectoryPath);
  const targetSegments = normalizePathSegments(targetPath, homeDirectoryPath);

  if (patternSegments.length === 0 || targetSegments.length === 0) {
    return { isMatch: false, captures: [] };
  }

  const captures: string[] = [];
  let pIdx = 0;
  let tIdx = 0;

  while (pIdx < patternSegments.length && tIdx < targetSegments.length) {
    const pSeg = patternSegments[pIdx];
    const tSeg = targetSegments[tIdx];

    if (pSeg === undefined || tSeg === undefined) {
      break;
    }

    if (pSeg === "**") {
      if (pIdx === patternSegments.length - 1) {
        const remaining = targetSegments.slice(tIdx).join("/");
        captures.push(remaining);
        return {
          isMatch: true,
          captures,
          projectName: targetSegments[targetSegments.length - 1],
        };
      }
      pIdx++;
      const nextPatSeg = patternSegments[pIdx];
      let matchedIdx = -1;
      for (let i = tIdx; i < targetSegments.length; i++) {
        if (targetSegments[i] === nextPatSeg || nextPatSeg === "*") {
          matchedIdx = i;
          break;
        }
      }
      if (matchedIdx === -1) {
        return { isMatch: false, captures: [] };
      }
      captures.push(targetSegments.slice(tIdx, matchedIdx).join("/"));
      tIdx = matchedIdx;
      continue;
    }

    if (pSeg === "*") {
      captures.push(tSeg);
      pIdx++;
      tIdx++;
      continue;
    }

    if (pSeg.includes("*")) {
      const regexPattern = `^${pSeg.replaceAll("*", "([^/]+)")}$`;
      const regex = new RegExp(regexPattern);
      const match = tSeg.match(regex);
      if (!match) {
        return { isMatch: false, captures: [] };
      }
      for (let i = 1; i < match.length; i++) {
        const cap = match[i];
        if (cap !== undefined) {
          captures.push(cap);
        }
      }
      pIdx++;
      tIdx++;
      continue;
    }

    if (pSeg !== tSeg) {
      return { isMatch: false, captures: [] };
    }

    pIdx++;
    tIdx++;
  }

  const isMatch = pIdx === patternSegments.length && tIdx === targetSegments.length;
  const lastTargetSegment = targetSegments[targetSegments.length - 1];
  const projectName = captures.length > 0 ? captures[captures.length - 1] : lastTargetSegment;

  return {
    isMatch,
    captures,
    projectName,
  };
}

export function interpolatePathPlaceholders(
  loadPath: string,
  projectName?: string,
  captures?: readonly string[],
): string {
  let result = loadPath;

  if (projectName !== undefined) {
    result = result
      .replaceAll("[project]", projectName)
      .replaceAll(":project", projectName)
      .replaceAll("[name]", projectName);
  }

  if (captures !== undefined && captures.length > 0) {
    captures.forEach((capture, index) => {
      const captureIndex = index + 1;
      result = result.replaceAll(`:${captureIndex}`, capture).replaceAll(`$${captureIndex}`, capture);
    });
  }

  return result;
}

export function parseSkillFrontmatter(content: string): IParsedSkillFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || !match[1]) {
    return {};
  }
  const lines = match[1].split(/\r?\n/);
  let name: string | undefined;
  let description: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const nameMatch = rawLine.match(/^name:\s*(.+)$/);
    if (nameMatch && nameMatch[1]) {
      name = nameMatch[1].trim().replace(/^['"](.*)['"]$/, "$1");
      continue;
    }

    const descMatch = rawLine.match(/^description:\s*(.*)$/);
    if (descMatch) {
      const rest = (descMatch[1] ?? "").trim();
      if (rest === ">-" || rest === ">" || rest === "|-" || rest === "|") {
        // Collect following indented lines
        const blockLines: string[] = [];
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j] ?? "";
          if (nextLine.startsWith("  ") || nextLine.startsWith("\t")) {
            blockLines.push(nextLine.trim());
            j++;
          } else {
            break;
          }
        }
        description = blockLines.join(" ");
        i = j - 1;
      } else if (rest.length > 0) {
        description = rest.replace(/^['"](.*)['"]$/, "$1");
      }
    }
  }

  return { name, description };
}

export function findPromptFile(directoryPath: string, checkFileExists: FileExistsFn = existsSync): string | undefined {
  for (const fileName of PROMPT_FILE_NAMES) {
    const candidatePath = join(directoryPath, fileName);
    if (checkFileExists(candidatePath)) {
      return candidatePath;
    }
  }
  return undefined;
}

export interface IScannedLayerAssets {
  readonly promptFileName?: string | undefined;
  readonly promptContent?: string | undefined;
  readonly skills: ISkillMetadata[];
  readonly promptNames: string[];
}

export function scanLayerAssets(
  directoryPath: string,
  checkFileExists: FileExistsFn = existsSync,
  directoryReader: DirectoryReaderFn = (dirPath) => readdirSync(dirPath),
  fileReader: FileReaderFn = (filePath) => readFileSync(filePath, "utf-8"),
): IScannedLayerAssets {
  const promptPath = findPromptFile(directoryPath, checkFileExists);
  const promptFileName = promptPath ? basename(promptPath) : undefined;
  let promptContent: string | undefined;
  if (promptPath) {
    try {
      promptContent = fileReader(promptPath);
    } catch {
      // Ignore unreadable prompt
    }
  }

  const skills: ISkillMetadata[] = [];
  const skillsSubdirectory = join(directoryPath, "skills");
  if (checkFileExists(skillsSubdirectory)) {
    try {
      const entries = directoryReader(skillsSubdirectory);
      for (const entry of entries) {
        const skillDirPath = join(skillsSubdirectory, entry);
        const skillFilePath = join(skillDirPath, "SKILL.md");
        const singleFileSkillPath = join(skillsSubdirectory, `${entry}.md`);

        if (checkFileExists(skillFilePath)) {
          try {
            const content = fileReader(skillFilePath);
            const frontmatter = parseSkillFrontmatter(content);
            skills.push({
              name: frontmatter.name ?? entry,
              description: frontmatter.description ?? `Skill in ${entry}`,
              path: skillFilePath,
            });
          } catch {
            skills.push({
              name: entry,
              description: `Skill in ${entry}`,
              path: skillFilePath,
            });
          }
        } else if (entry.endsWith(".md") && checkFileExists(singleFileSkillPath)) {
          const skillName = entry.replace(/\.md$/, "");
          try {
            const content = fileReader(singleFileSkillPath);
            const frontmatter = parseSkillFrontmatter(content);
            skills.push({
              name: frontmatter.name ?? skillName,
              description: frontmatter.description ?? `Skill in ${skillName}`,
              path: singleFileSkillPath,
            });
          } catch {
            skills.push({
              name: skillName,
              description: `Skill in ${skillName}`,
              path: singleFileSkillPath,
            });
          }
        }
      }
    } catch {
      // Ignore unreadable skills directory
    }
  }

  const promptNames: string[] = [];
  const promptsSubdirectory = join(directoryPath, "prompts");
  if (checkFileExists(promptsSubdirectory)) {
    try {
      const entries = directoryReader(promptsSubdirectory);
      for (const entry of entries) {
        if (entry.endsWith(".md")) {
          const commandName = entry.slice(0, -3);
          if (!promptNames.includes(commandName)) {
            promptNames.push(commandName);
          }
        }
      }
    } catch {
      // Ignore unreadable prompts directory
    }
  }

  return {
    ...(promptFileName !== undefined ? { promptFileName } : {}),
    ...(promptContent !== undefined ? { promptContent } : {}),
    skills,
    promptNames,
  };
}

export function findMainRepositoryRoot(startDirectory: string): string | undefined {
  let currentDirectory = resolve(startDirectory);

  while (true) {
    const gitPath = join(currentDirectory, ".git");
    if (existsSync(gitPath)) {
      try {
        const stats = statSync(gitPath);
        if (stats.isDirectory()) {
          return currentDirectory;
        }
        if (stats.isFile()) {
          const content = readFileSync(gitPath, "utf-8").trim();
          const match = content.match(/^gitdir:\s*(.+)$/m);
          if (match && match[1]) {
            const gitDir = resolve(currentDirectory, match[1].trim());
            const commonDirFile = join(gitDir, "commondir");
            if (existsSync(commonDirFile)) {
              const commonDirRelative = readFileSync(commonDirFile, "utf-8").trim();
              const commonDir = resolve(gitDir, commonDirRelative);
              return dirname(commonDir);
            }
            return resolve(gitDir, "../../..");
          }
        }
      } catch {
        // Ignore unreadable .git entries
      }
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  return undefined;
}

function stripGitComment(line: string): string {
  let isInDoubleQuote = false;
  let isInSingleQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && !isInSingleQuote) {
      isInDoubleQuote = !isInDoubleQuote;
    } else if (char === "'" && !isInDoubleQuote) {
      isInSingleQuote = !isInSingleQuote;
    } else if ((char === "#" || char === ";") && !isInDoubleQuote && !isInSingleQuote) {
      return line.slice(0, i).trim();
    }
  }

  return line.trim();
}

export function parseGitConfigLoads(configContent: string): string[] {
  const lines = configContent.split(/\r?\n/);
  let isInTargetSection = false;
  const configValues: string[] = [];
  const loadValues: string[] = [];
  const pathValues: string[] = [];

  for (const rawLine of lines) {
    const cleanLine = stripGitComment(rawLine);
    if (cleanLine.length === 0) {
      continue;
    }

    const sectionMatch = cleanLine.match(/^\[\s*([a-zA-Z0-9_\-.]+)(?:\s+.*)?\]$/);
    if (sectionMatch) {
      const sectionName = (sectionMatch[1] ?? "").toLowerCase();
      isInTargetSection =
        sectionName === "claude-workspace" || sectionName === "workspace" || sectionName === "pi-workspace";
      continue;
    }

    if (!isInTargetSection) {
      continue;
    }

    const keyValueMatch = cleanLine.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
    if (keyValueMatch) {
      const keyName = (keyValueMatch[1] ?? "").toLowerCase();
      let rawValue = (keyValueMatch[2] ?? "").trim();

      if (
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ) {
        rawValue = rawValue.slice(1, -1).trim();
      }

      const pathSegments = rawValue
        .split(",")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

      if (keyName === "config") {
        for (const segment of pathSegments) {
          configValues.push(segment);
        }
      } else if (keyName === "load") {
        for (const segment of pathSegments) {
          loadValues.push(segment);
        }
      } else if (keyName === "path") {
        for (const segment of pathSegments) {
          pathValues.push(segment);
        }
      }
    }
  }

  if (configValues.length > 0) {
    return configValues;
  }
  return loadValues.length > 0 ? loadValues : pathValues;
}

export function readGitConfigLoads(repositoryRoot: string, options?: IWorkspaceResolverOptions): string[] {
  if (options?.gitConfigReader) {
    return options.gitConfigReader(repositoryRoot);
  }

  // 1. Try Git CLI across known config keys
  for (const configKey of GIT_CONFIG_KEYS) {
    try {
      const output = execFileSync("git", ["config", "--get-all", configKey], {
        cwd: repositoryRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const parsed: string[] = [];
      const lines = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      for (const line of lines) {
        const splitItems = line
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        for (const item of splitItems) {
          parsed.push(item);
        }
      }
      if (parsed.length > 0) {
        return parsed;
      }
    } catch {
      // CLI not available or key not found
    }
  }

  // 2. Direct filesystem read fallback
  const checkFileExists = options?.fileExists ?? existsSync;
  const fileReader = options?.fileReader ?? ((filePath) => readFileSync(filePath, "utf-8"));

  const gitPath = join(repositoryRoot, ".git");
  if (checkFileExists(gitPath)) {
    try {
      const stats = statSync(gitPath);
      if (stats.isFile()) {
        const content = fileReader(gitPath).trim();
        const match = content.match(/^gitdir:\s*(.+)$/m);
        if (match && match[1]) {
          const gitDir = resolve(repositoryRoot, match[1].trim());
          const worktreeConfigPath = join(gitDir, "config.worktree");
          if (checkFileExists(worktreeConfigPath)) {
            const worktreeContent = fileReader(worktreeConfigPath);
            const worktreeLoads = parseGitConfigLoads(worktreeContent);
            if (worktreeLoads.length > 0) {
              return worktreeLoads;
            }
          }
        }
      }
    } catch {
      // Ignore unreadable worktree gitdir
    }
  }

  const mainRepo = findMainRepositoryRoot(repositoryRoot) ?? repositoryRoot;
  const configPath = join(mainRepo, ".git", "config");
  if (checkFileExists(configPath)) {
    try {
      const content = fileReader(configPath);
      const parsed = parseGitConfigLoads(content);
      if (parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Ignore unreadable config
    }
  }

  return [];
}

export function loadGitWorkspaceConfig(
  directory: string,
  options?: IWorkspaceResolverOptions,
): IWorkspaceConfig | undefined {
  const mainRepositoryRoot = findMainRepositoryRoot(directory);
  if (!mainRepositoryRoot) {
    return undefined;
  }

  const rawLoads = readGitConfigLoads(directory, options);
  if (rawLoads.length === 0) {
    return undefined;
  }

  const checkFileExists = options?.fileExists ?? existsSync;
  const fileReader = options?.fileReader ?? ((filePath) => readFileSync(filePath, "utf-8"));
  const homeDirectoryPath = options?.homeDirectoryPath;

  const firstRaw = rawLoads[0];
  if (firstRaw) {
    const expandedFirst = expandHomeDirectory(firstRaw, homeDirectoryPath);
    const resolvedFirst = isAbsolute(expandedFirst) ? expandedFirst : resolve(mainRepositoryRoot, expandedFirst);

    if (firstRaw.endsWith(".json") || (checkFileExists(resolvedFirst) && resolvedFirst.endsWith(".json"))) {
      try {
        const fileContent = fileReader(resolvedFirst);
        const parsedJson = JSON.parse(fileContent);
        const parsedConfig = parseWorkspaceConfig(parsedJson);

        if (parsedConfig && parsedConfig.configs && parsedConfig.configs.length > 0) {
          const jsonDir = dirname(resolvedFirst);
          const normalizedRules: IWorkspaceRule[] = parsedConfig.configs.map((rule) => {
            const rawTargets = Array.isArray(rule.load) ? rule.load : [rule.load];
            const normalizedTargets = rawTargets.map((target) => {
              const exp = expandHomeDirectory(target, homeDirectoryPath);
              return isAbsolute(exp) ? exp : resolve(jsonDir, exp);
            });
            const ruleLoad: WorkspaceRuleLoad =
              normalizedTargets.length === 1 && normalizedTargets[0] !== undefined
                ? normalizedTargets[0]
                : normalizedTargets;
            return {
              when: rule.when,
              load: ruleLoad,
            };
          });

          return {
            configs: normalizedRules,
            gitConfigValue: resolvedFirst,
          };
        }
      } catch (error) {
        console.error(`[claude-workspace] Failed to parse JSON config from ${resolvedFirst}:`, error);
      }
    }
  }

  const resolvedPaths: string[] = [];
  for (const rawPath of rawLoads) {
    const expanded = expandHomeDirectory(rawPath, homeDirectoryPath);
    const resolvedPath = isAbsolute(expanded) ? expanded : resolve(mainRepositoryRoot, expanded);
    if (!resolvedPaths.includes(resolvedPath)) {
      resolvedPaths.push(resolvedPath);
    }
  }

  if (resolvedPaths.length === 0) {
    return undefined;
  }

  const ruleWhen = collapseHomeDirectory(mainRepositoryRoot, homeDirectoryPath);
  const ruleLoad: WorkspaceRuleLoad =
    resolvedPaths.length === 1 && resolvedPaths[0] !== undefined ? resolvedPaths[0] : resolvedPaths;

  return {
    configs: [
      {
        when: ruleWhen,
        load: ruleLoad,
      },
    ],
    gitConfigValue: rawLoads.length === 1 && rawLoads[0] !== undefined ? rawLoads[0] : rawLoads,
  };
}

export function resolveMatchedWorkspaceLayers(
  currentWorkingDirectory: string,
  options?: IWorkspaceResolverOptions,
): IWorkspaceMatchedLayer[] {
  const effectiveConfig = options?.config ?? loadGitWorkspaceConfig(currentWorkingDirectory, options);
  const rules = effectiveConfig?.configs;
  if (!rules || rules.length === 0) {
    return [];
  }

  const checkFileExists = options?.fileExists ?? existsSync;
  const directoryReader = options?.directoryReader ?? readdirSync;
  const fileReader = options?.fileReader ?? ((filePath) => readFileSync(filePath, "utf-8"));
  const mainRepositoryRoot = findMainRepositoryRoot(currentWorkingDirectory);
  const matchedList: IWorkspaceMatchedLayer[] = [];

  for (const rule of rules) {
    const directMatch = matchWorkspacePatternWithCaptures(
      rule.when,
      currentWorkingDirectory,
      options?.homeDirectoryPath,
    );
    const worktreeMatch =
      !directMatch.isMatch && mainRepositoryRoot !== undefined
        ? matchWorkspacePatternWithCaptures(rule.when, mainRepositoryRoot, options?.homeDirectoryPath)
        : undefined;

    const match = directMatch.isMatch ? directMatch : worktreeMatch?.isMatch ? worktreeMatch : undefined;

    if (match) {
      const targetPaths = Array.isArray(rule.load) ? rule.load : [rule.load];
      const projectName =
        match.projectName ?? (mainRepositoryRoot ? basename(mainRepositoryRoot) : basename(currentWorkingDirectory));

      for (const rawPath of targetPaths) {
        const interpolatedPath = interpolatePathPlaceholders(rawPath, projectName, match.captures);
        const expanded = expandHomeDirectory(interpolatedPath, options?.homeDirectoryPath);
        const resolvedDirectory = resolve(expanded);

        if (checkFileExists(resolvedDirectory)) {
          const scan = scanLayerAssets(resolvedDirectory, checkFileExists, directoryReader, fileReader);
          const alreadyMatched = matchedList.some((m) => m.load === resolvedDirectory && m.when === rule.when);
          if (!alreadyMatched) {
            matchedList.push({
              when: rule.when,
              load: resolvedDirectory,
              ...(scan.promptFileName !== undefined ? { promptFileName: scan.promptFileName } : {}),
              ...(scan.promptContent !== undefined ? { promptContent: scan.promptContent } : {}),
              skills: scan.skills,
              promptNames: scan.promptNames,
            });
          }
        }
      }
    }
  }

  return matchedList;
}
