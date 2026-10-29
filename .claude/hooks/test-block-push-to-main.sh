#!/usr/bin/env bash
# Tests for .claude/hooks/block-push-to-main.sh
#
# The tests give the hook a synthetic Bash tool call. Then they compare the exit
# code (2 = block, 0 = pass). Run the tests from the root of the repository:
#   ./.claude/hooks/test-block-push-to-main.sh
#
# Each BLOCK case below is a way to go around the hook. A change that opens one
# of these ways again must make these tests fail.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
HOOK="$SCRIPT_DIR/block-push-to-main.sh"

if [ ! -x "$HOOK" ]; then
  echo "FAIL: the hook is not executable: $HOOK" >&2
  exit 1
fi

failures=0
rc=0

run_hook() {
  local cmd="$1"
  local payload
  payload=$(printf '%s' "$cmd" | python3 -c '
import json, sys
print(json.dumps({"tool_input": {"command": sys.stdin.read()}}))')
  printf '%s' "$payload" | bash "$HOOK" >/dev/null 2>&1
  rc=$?
}

assert_block() {
  run_hook "$1"
  if [ "$rc" -ne 2 ]; then
    echo "FAIL: expected BLOCK (exit 2), but got exit $rc for: $1" >&2
    failures=$((failures + 1))
  fi
}

assert_pass() {
  run_hook "$1"
  if [ "$rc" -ne 0 ]; then
    echo "FAIL: expected PASS (exit 0), but got exit $rc for: $1" >&2
    failures=$((failures + 1))
  fi
}

# --- PASS: a push to a feature branch, a tag, and a command that is not a push ---
assert_pass "git push -u origin claude/dal-repo-meta-principles-94863i"
assert_pass "git push -u origin feat/potential-miles"
assert_pass "git push origin v1.0.0"
assert_pass "git push --tags"
assert_pass "git fetch --all"
assert_pass "git log --all --oneline"
assert_pass "git branch --all"
assert_pass "git push origin maintenance"
assert_pass "npm run build"

# --- BLOCK: each refspec with main as the destination ---
assert_block "git push origin main"
assert_block "git push -u origin main"
assert_block "git push --force origin main"
assert_block "git push --force-with-lease origin main"
assert_block "git push origin develop:main"
assert_block "git push origin :main"
assert_block "git push origin +main"
assert_block "git push origin HEAD:main"
assert_block "git push origin refs/heads/main"
assert_block "git -C . push origin main"
assert_block "cd /home/user/airchive && git push origin main"

# --- BLOCK: `--all` and `--mirror` send main but never write the name ---
assert_block "git push --all origin"
assert_block "git push origin --all"
assert_block "git push --mirror origin"

if [ "$failures" -gt 0 ]; then
  echo "$failures test(s) failed." >&2
  exit 1
fi

echo "All the tests of block-push-to-main passed."
