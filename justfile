set dotenv-load := false

# Run CLI in human mode (default)
run *args:
    bun run src/main.ts {{args}}

# Run CLI in agent-facing token-conservative mode
run-ai *args:
    AGENT=1 bun run src/main.ts {{args}}

# Run unit tests
test:
    bun test

# Run local test runner
test-local *args:
    bun run scripts/test-local.ts {{args}}

# Run worktree test runner
test-worktree *args:
    bun run scripts/test-worktree.ts {{args}}

# Typecheck and lint
check:
    bun run check

# Format code
fix:
    bun run fix
