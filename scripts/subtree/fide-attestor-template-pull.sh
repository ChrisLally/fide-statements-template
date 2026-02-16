#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PREFIX="${PREFIX:-packages/fcp/demos/experimental/fide-attestor-template}"
REMOTE_URL="${REMOTE_URL:-https://github.com/ChrisLally/fide-attestor-template.git}"
REMOTE_BRANCH="${REMOTE_BRANCH:-main}"
SQUASH_FLAG="${SQUASH_FLAG:---squash}"

cd "$ROOT"

echo "[subtree pull] pulling $REMOTE_URL:$REMOTE_BRANCH -> $PREFIX ($SQUASH_FLAG)"
git subtree pull --prefix="$PREFIX" "$REMOTE_URL" "$REMOTE_BRANCH" "$SQUASH_FLAG"

echo "[subtree pull] complete"
