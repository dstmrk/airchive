#!/usr/bin/env bash
# PreToolUse hook on Bash — blocks `git commit` while the current branch is main.
# Rationale: CLAUDE.md, section Git ("Do work on a feature branch. Do not commit
# to `main`"). block-push-to-main.sh alone leaves a dirty state: a commit made on
# main cannot be pushed, and someone must move it to a branch afterwards.
# A block at commit time keeps main clean.

set -euo pipefail

cmd=$(jq -r '.tool_input.command // ""' 2>/dev/null) || cmd=""

# Collapse repeated whitespace so the regex sees the actual git command.
normalized=$(printf '%s' "$cmd" | tr -s ' ')

# Match a `commit` subcommand. The optional group admits the global options
# between `git` and the subcommand (`-C <dir>`, `-c k=v`, `--git-dir=…`).
# A regex that demands `git commit` adjacency lets `git -C . commit` through.
if printf '%s' "$normalized" | grep -qE 'git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+commit([[:space:]]|$)'; then
  # Empty output = detached HEAD (rebase, bisect) => not "on main", so allow.
  branch=$(git branch --show-current 2>/dev/null || true)
  if [ "$branch" = "main" ]; then
    echo "Blocked by .claude/hooks/block-commit-on-main.sh:" >&2
    echo "  A commit on main is forbidden (CLAUDE.md, section Git)." >&2
    echo "  Make a feature branch first: git checkout -b <branch-name>" >&2
    exit 2
  fi
fi

exit 0
