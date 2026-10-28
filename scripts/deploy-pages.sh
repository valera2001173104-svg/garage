#!/usr/bin/env bash
# Builds the app for GitHub Pages and publishes it to the `gh-pages` branch of this repo.
# Needs: `gh` logged in, an `origin` remote. Usage: npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE=$(git remote get-url origin)
NAME=$(basename "$REMOTE" .git)
AUTHOR=$(git config user.name || echo deploy)
EMAIL=$(git config user.email || echo deploy@users.noreply.github.com)
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

echo "→ build for /$NAME/"
npx tsc --noEmit
BASE_PATH="/$NAME/" npx vite build --outDir "$OUT" --emptyOutDir

echo "→ publish to gh-pages"
(
  cd "$OUT"
  git init -q -b gh-pages
  git add -A
  git -c user.name="$AUTHOR" -c user.email="$EMAIL" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
  git remote add origin "$REMOTE"
  git push -q -f origin gh-pages
)
OWNER=$(echo "$REMOTE" | sed -E 's#.*github\.com[:/]([^/]+)/.*#\1#')
echo "✓ pushed. Site: https://$OWNER.github.io/$NAME/ (GitHub rebuilds it in about a minute)"
