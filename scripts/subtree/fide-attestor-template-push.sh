#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PREFIX="${PREFIX:-packages/fcp/demos/fide-attestor-template}"
REMOTE_URL="${REMOTE_URL:-https://github.com/ChrisLally/fide-attestor-template.git}"
REMOTE_BRANCH="${REMOTE_BRANCH:-main}"
SPLIT_BRANCH="${SPLIT_BRANCH:-codex/fide-attestor-template-split}"

cd "$ROOT"

echo "[subtree push] splitting $PREFIX -> $SPLIT_BRANCH"
git subtree split --prefix="$PREFIX" -b "$SPLIT_BRANCH"

echo "[subtree push] pushing $SPLIT_BRANCH -> $REMOTE_URL:$REMOTE_BRANCH"
git push "$REMOTE_URL" "$SPLIT_BRANCH:$REMOTE_BRANCH"

echo "[subtree push] complete"
