`@alexgorbatchev/claude-workspace` is a Claude Code plugin and CLI for hierarchical out-of-tree workspaces, injecting layered instructions, prompts, and skills without modifying target repositories.

By default, configuring project-specific instructions, skills, and settings in Claude Code requires adding a `CLAUDE.md` or `.claude/` directory inside the target repository, or maintaining global instructions in `~/.claude/CLAUDE.md`. This creates friction when working on client codebases, open-source projects, or team repositories where committing agent-specific artifacts is prohibited, or when managing dozens of microservices that need to share organizational standards without duplicating configuration across every repository and Git worktree. `@alexgorbatchev/claude-workspace` solves this by keeping all workspace assets completely out-of-tree, allowing repositories and worktrees to autodiscover their layered instructions, prompts, and skills via Git configuration while preserving a 100% clean Git working tree.

# What It Does

- Autodiscovers out-of-tree workspace configurations via Git configuration and worktree inheritance.
- Resolves hierarchical layered instructions, prompt files, and skills using `workspace.json` rules.
- Injects workspace instructions and available skills directly into Claude Code sessions via `SessionStart` hooks.
- Preserves a 100% clean Git working tree in target repositories with zero committed agent configuration files.

# How It Works

- Inspects the active repository's Git configuration for `claude-workspace.config` or `claude-workspace.load`.
- Follows linked Git worktrees back to the common repository root so worktrees automatically share configuration.
- Evaluates directory wildcard patterns and interpolates project placeholders such as `[project]` or `:project`.
- Extracts system instructions from `APPEND_SYSTEM.md`, `SYSTEM.md`, `AGENTS.md`, or `CLAUDE.md` and indexes workspace skills.
- Returns a structured `SessionStart` hook payload providing `systemMessage` for the user and `additionalContext` for Claude.

# How it Really Works

- Git configuration is resolved by first querying `git config --get-all` across `claude-workspace.config`, `claude-workspace.load`, `workspace.config`, `workspace.load`, `pi-workspace.config`, and `pi-workspace.load`, then falling back to direct `.git/config` and worktree `config.worktree` parsing if the Git CLI is unavailable.
- If a configured Git value points to a `.json` configuration file, rules are parsed from that file and any relative paths inside the file are resolved relative to the JSON file's parent directory rather than the repository root.
- The `SessionStart` hook receives Claude Code lifecycle event JSON on stdin, evaluates matched layers for `cwd`, and outputs a JSON response containing `systemMessage` (formatted summary report) and `hookSpecificOutput.additionalContext` (concatenated markdown instructions and skill registry).
- When the `AGENT=1` environment variable is set, the CLI switches from aligned tree formatting to token-conservative text lines without decorative borders or boxes.
- Zero files are written or modified inside target repositories, ensuring `git status` remains completely untouched.

# Prerequisites

- [Claude Code](https://code.claude.com) - Anthropic CLI harness for AI coding agents.
- [Node.js](https://nodejs.org) (`>= 18`) - Standard JavaScript runtime (no Bun required on user machines).

# Installation

Install the plugin directly into Claude Code:

```bash
# 1. Add marketplace (one time)
claude plugin marketplace add alexgorbatchev/claude-workspace

# 2. Install the plugin
claude plugin install claude-workspace@alexgorbatchev
```

Once installed, Claude Code automatically executes the `SessionStart` hook on every session launch using standard Node.js. No binaries are added to `$PATH`, and no configuration files need to be edited.

### Local Testing

To test directly from a local checkout without installing:

```bash
claude --plugin-dir /path/to/claude-workspace
```

# Quick Start

### 1. Point Git to an Out-of-tree Workspace Configuration

Configure workspace paths in your repository's local Git configuration:

```bash
# Point to a workspace.json configuration file
git config --local claude-workspace.config ~/.ai/workspace.json

# Or load specific out-of-tree directories directly
git config --local --add claude-workspace.load ~/.ai/organization/_common
git config --local --add claude-workspace.load ~/.ai/organization/my-project
```

### 2. Inspect Resolved Layers

Verify resolved workspace layers without launching Claude Code:

```bash
node /path/to/claude-workspace/dist/index.js workspace inspect
```

Sample Output:

```
SessionStart:startup says:

[@alexgorbatchev/claude-workspace]
  git: ~/development/company-a.com/workspace.json
  cwd: ~/development/company-a.com/auth-service
  config:
    when: ~/development/company-a.com/*
    load: ~/development/company-a.com/.ai/common
      prompt: APPEND_SYSTEM.md
      skills:
        - org-helper
        - ci-helper
  config:
    when: ~/development/company-a.com/*
    load: ~/development/company-a.com/.ai/auth-service
      prompt: APPEND_SYSTEM.md
```

### 3. Launch Claude Code

```bash
claude
```

When launched in the repository or any linked worktree, Claude Code automatically triggers the `SessionStart` hook, displays the active workspace report banner, and injects all layer instructions and skills into context before the first prompt.

# Options & Flags

### Global Options

| Flag        | Short | Default | Description               |
| :---------- | :---- | :------ | :------------------------ |
| `--version` | `-V`  | `false` | Output the version number |
| `--help`    | `-h`  | `false` | Display help for command  |

### `claude-workspace hook session-start`

| Flag           | Short | Default         | Description              |
| :------------- | :---- | :-------------- | :----------------------- |
| `--cwd <path>` | `-c`  | `process.cwd()` | Target working directory |

### `claude-workspace workspace inspect [path]`

Inspects resolved workspace layers for the specified path (or current directory if omitted).

### `claude-workspace workspace list [path]`

Lists configured workspace rules and Git configuration values for the specified path.

# Local Testing

Test the plugin locally against checked-in fixtures representing all configuration styles:

```bash
# 1. Test against current repository
bun run test:local

# 2. Test exact path mapping (company-b/client-portal -> portal)
bun run test:local portal

# 3. Test Git worktree autodiscovery (claude-workspace.load inherited by linked worktrees)
bun run test:worktree

# 4. Test main repository checkout for the Git config scenario
bun run test:worktree main
```

# License

MIT License (c) 2026 Alex Gorbatchev
