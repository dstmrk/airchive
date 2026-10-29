#!/usr/bin/env bash
# PreToolUse hook on Bash — blocks `git push` that targets main.
# Rationale: CLAUDE.md, section Git. Each change goes through a pull request.
# The merge is the decision of the user. A push of a tag is possible, because a
# tag does not reference main.

set -euo pipefail

cmd=$(jq -r '.tool_input.command // ""' 2>/dev/null) || cmd=""

# Collapse repeated whitespace so the regex sees the actual git command.
normalized=$(printf '%s' "$cmd" | tr -s ' ')

# Match a `push` subcommand. The optional group admits the global options
# between `git` and the subcommand (`-C <dir>`, `-c k=v`, `--git-dir=…`).
GIT_PUSH='git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+push'

blocked=""

# Catch each refspec whose destination is main. A regex that accepts only a
# space before `main` leaves these ways to go around the hook:
#   - `develop:main` (it pushes the commits of develop to main)
#   - `:main` (it deletes main on the remote)
#   - `+main` and `--force-with-lease … main` (they force-update main)
#   - `refs/heads/main` (the explicit refspec)
# The boundary `([[:space:]:+]|^)` admits a space, a `:`, a `+` or the start of
# the line. `refs/heads/main` is explicit, because `/` is not in the boundary.
if printf '%s' "$normalized" | grep -qE "${GIT_PUSH}.*([[:space:]:+]|^)(main|HEAD:main|refs/heads/main)([[:space:]]|\$)"; then
  blocked="refspec"
fi

# `--all` and `--mirror` send EACH local branch, main included, but they never
# write the name. Thus the regex on the refspec does not see them, and
# `--mirror` can also delete a remote ref. The match stays anchored to a `push`
# command, to keep `git fetch --all` and `git log --all` free.
if printf '%s' "$normalized" | grep -qE "${GIT_PUSH}([[:space:]].*)?[[:space:]](--all|--mirror)([[:space:]]|=|\$)"; then
  blocked="broadcast"
fi

if [ -n "$blocked" ]; then
  echo "Blocked by .claude/hooks/block-push-to-main.sh:" >&2
  if [ "$blocked" = "broadcast" ]; then
    echo "  \`git push --all/--mirror\` sends each local branch, main included" >&2
    echo "  (CLAUDE.md, section Git). Push your branch with an explicit name:" >&2
    echo "  git push -u origin <branch-name>" >&2
  else
    echo "  A direct push to main is forbidden (CLAUDE.md, section Git)." >&2
    echo "  Always use a pull request." >&2
  fi
  echo "  If the user authorized this operation, use a shell outside Claude," >&2
  echo "  or make this hook inactive for a short time." >&2
  exit 2
fi

exit 0
