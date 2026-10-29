#!/usr/bin/env bash
# Tests for .claude/hooks/block-commit-on-main.sh
#
# The tests give the hook a synthetic Bash tool call from git repositories on
# different branches. Then they compare the exit code (2 = block, 0 = pass).
# Run the tests from the root of the repository:
#   ./.claude/hooks/test-block-commit-on-main.sh
#
# A hook that stops the block of `git commit` on main, or that starts to block
# a commit on a feature branch, must make these tests fail.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
HOOK="$SCRIPT_DIR/block-commit-on-main.sh"

if [ ! -x "$HOOK" ]; then
  echo "FAIL: the hook is not executable: $HOOK" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

git init -q -b main "$TMP/on-main"
git init -q -b main "$TMP/on-feature"
git -C "$TMP/on-feature" checkout -q -b feature
mkdir -p "$TMP/non-repo"

failures=0
rc=0

# Run the hook with the given false Bash command, from the given directory.
run_hook() {
  local cmd="$1"
  local dir="$2"
  local payload
  payload=$(printf '%s' "$cmd" | python3 -c '
import json, sys
print(json.dumps({"tool_input": {"command": sys.stdin.read()}}))')
  printf '%s' "$payload" | (cd "$dir" && bash "$HOOK") >/dev/null 2>&1
  rc=$?
}

assert_block() {
  local cmd="$1" dir="$2"
  run_hook "$cmd" "$dir"
  if [ "$rc" -ne 2 ]; then
    echo "FAIL: expected BLOCK (exit 2), but got exit $rc for: $cmd (in $dir)" >&2
    failures=$((failures + 1))
  fi
}

assert_pass() {
  local cmd="$1" dir="$2"
  run_hook "$cmd" "$dir"
  if [ "$rc" -ne 0 ]; then
    echo "FAIL: expected PASS (exit 0), but got exit $rc for: $cmd (in $dir)" >&2
    failures=$((failures + 1))
  fi
}

# --- PASS: a commit on a feature branch, a git command that is not a commit on
# main, and a commit outside a git repository (no branch => allow) ---
assert_pass "git commit -m 'feat: add the BCBP parser'" "$TMP/on-feature"
assert_pass "git add -A && git commit -m 'feat: x'" "$TMP/on-feature"
assert_pass "git -C . commit --amend --no-edit" "$TMP/on-feature"
assert_pass "git status" "$TMP/on-main"
assert_pass "git log --grep commit" "$TMP/on-main"
assert_pass "git checkout -b feature" "$TMP/on-main"
assert_pass "npm run lint" "$TMP/on-main"
assert_pass "git commit -m 'x'" "$TMP/non-repo"

# --- BLOCK: each commit while the current branch is main ---
assert_block "git commit -m 'feat: x'" "$TMP/on-main"
assert_block "git commit --amend --no-edit" "$TMP/on-main"
assert_block "git add -A && git commit -m 'feat: x'" "$TMP/on-main"
assert_block "git -C . commit -m 'feat: x'" "$TMP/on-main"
assert_block "git -c user.name=x commit -m 'feat: x'" "$TMP/on-main"

if [ "$failures" -gt 0 ]; then
  echo "$failures test(s) failed." >&2
  exit 1
fi

echo "All the tests of block-commit-on-main passed."
