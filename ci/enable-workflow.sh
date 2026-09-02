#!/usr/bin/env bash
# One-time setup: copy the CI definition into .github/workflows so GitHub runs it.
#
# `.github/workflows/apk.yml` is already committed on the current branch, so normally you only have
# to merge that PR — this script is for rebuilding the copy by hand (e.g. after editing ci/apk.yml).
# Note: GitHub registers workflows from the *default* branch only, so the file has to reach `main`.
#
#   ./ci/enable-workflow.sh              # copy + commit on the current branch
#   ./ci/enable-workflow.sh --push       # ... and push it to origin
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="ci/apk.yml"
DEST=".github/workflows/apk.yml"
PUSH="${1:-}"

mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"

if git rev-parse --git-dir >/dev/null 2>&1; then
  git add "$DEST"
  if git diff --cached --quiet; then
    echo "= $DEST already matches $SRC — nothing to commit."
  else
    git -c user.name="${GIT_AUTHOR_NAME:-$(git config user.name || echo Rusindu12)}" \
        -c user.email="${GIT_AUTHOR_EMAIL:-$(git config user.email || echo rusindu@example.com)}" \
        commit -m "ci: build and publish an APK on every push"
    echo "✓ committed $DEST"
  fi
fi

if [[ "$PUSH" == "--push" ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  git push origin "$branch"
  echo "✓ pushed to origin/$branch — watch the build: gh run watch"
else
  echo
  echo "Next: push the branch (or use GitHub → Add file → Create new file with the path $DEST)"
  echo "      and Actions will start building the APK automatically."
fi
