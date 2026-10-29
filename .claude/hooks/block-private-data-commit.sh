#!/usr/bin/env bash
# PreToolUse hook on Bash — blocks `git add` of the private files.
# Rationale: CLAUDE.md, section Git ("Do not commit a private file").
# `.gitignore` gives the first defence, but `git add --force` goes around it,
# and a new file type can arrive before someone adds the pattern. This hook
# gives the second defence.
#
# A commit of the database or of a `.pkpass` file publishes the boarding passes
# of a person, and a commit of `.dev.vars` publishes the secrets of the Worker.
# Git keeps each one in the history after a later delete.

set -euo pipefail

cmd=$(jq -r '.tool_input.command // ""' 2>/dev/null) || cmd=""

# Collapse repeated whitespace so the regex sees the actual git command.
normalized=$(printf '%s' "$cmd" | tr -s ' ')

# Match an `add` subcommand. The optional group admits the global options
# between `git` and the subcommand (`-C <dir>`, `-c k=v`, `--git-dir=…`).
GIT_ADD='git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+add([[:space:]]|$)'

# Is this token a path that the repository must never contain?
is_forbidden_path() {
  local token="$1"
  # Remove the quotes that stay after the word split, then a leading `./`.
  token=${token#\'}
  token=${token%\'}
  token=${token#\"}
  token=${token%\"}
  token=${token#./}

  # `.env.example` and `.dev.vars.example` are the files of these families
  # under version control. They hold the names of the variables, not values.
  case "$token" in
  .env.example | */.env.example | .dev.vars.example | */.dev.vars.example) return 1 ;;
  esac

  case "$token" in
  data | data/* | */data | */data/*) return 0 ;;
  *.db | *.db-wal | *.db-shm | *.sqlite | *.sqlite3) return 0 ;;
  .env | .env.* | */.env | */.env.*) return 0 ;;
  # `.dev.vars` holds the secrets of the Worker for `wrangler dev`. `.wrangler/`
  # holds the local D1 database.
  .dev.vars | .dev.vars.* | */.dev.vars | */.dev.vars.*) return 0 ;;
  .wrangler | .wrangler/* | */.wrangler | */.wrangler/*) return 0 ;;
  # A real boarding pass holds the name, the booking reference and a barcode.
  *.pkpass) return 0 ;;
  esac

  return 1
}

reason=""
offender=""

# Examine each command of the line on its own. A path in a neighbour command —
# a commit message, a later `rm` — must not start this hook.
while IFS= read -r segment; do
  [ -n "$segment" ] || continue
  printf '%s' "$segment" | grep -qE "$GIT_ADD" || continue

  # `set -f` stops the shell from expanding a pattern such as `*.db` against
  # the files of the working directory during the word split.
  set -f
  # shellcheck disable=SC2086
  set -- $segment
  set +f

  for token in "$@"; do
    case "$token" in
    --force | --force=*)
      reason="force"
      offender="$token"
      break
      ;;
    --*) ;;
    -*f*)
      reason="force"
      offender="$token"
      break
      ;;
    esac
    if is_forbidden_path "$token"; then
      reason="path"
      offender="$token"
      break
    fi
  done

  [ -n "$reason" ] && break
done <<EOF
$(printf '%s' "$normalized" | sed 's/&&/\n/g; s/||/\n/g; s/;/\n/g; s/|/\n/g')
EOF

if [ -n "$reason" ]; then
  echo "Blocked by .claude/hooks/block-private-data-commit.sh:" >&2
  if [ "$reason" = "force" ]; then
    echo "  \`git add\` with $offender goes around .gitignore (CLAUDE.md, section Git)." >&2
    echo "  Name each file that you want to add, and do not use the force option." >&2
  else
    echo "  \`$offender\` is a private file (CLAUDE.md, section Git)." >&2
    echo "  A database file, data/, .wrangler/, a .pkpass file, .env and .dev.vars" >&2
    echo "  stay out of git. For a new variable, add the name to .dev.vars.example" >&2
    echo "  with no value." >&2
  fi
  exit 2
fi

exit 0
