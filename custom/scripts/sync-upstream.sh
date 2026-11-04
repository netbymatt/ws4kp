#!/usr/bin/env bash
# ATV fork: merge the latest upstream release into the fork branch and rebuild custom outputs.
# Usage: custom/scripts/sync-upstream.sh [upstream-ref]   (default: upstream/main)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

REF="${1:-upstream/main}"

if [ -n "$(git status --porcelain)" ]; then
	echo "✗ working tree not clean; commit or stash first" >&2
	exit 1
fi

# generated files keep our version on conflict (they are rebuilt below); see .gitattributes
git config merge.ours.driver true

git fetch upstream --tags
# full history is needed for clean merges if this clone started shallow
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
	git fetch --unshallow upstream
fi

echo "→ merging $REF"
git merge --no-edit "$REF"

echo "→ dependencies"
npm ci --no-audit --no-fund

echo "→ theme check"
node custom/scripts/check-theme.mjs

echo "→ geographic data"
node custom/scripts/build-data.mjs --offline

echo "→ css"
npm run build:css

if [ -n "$(git status --porcelain)" ]; then
	git add -A datagenerators/output custom/data server/styles/ws.min.css server/styles/ws.min.css.map
	git commit -m "Rebuild ATV data and theme after upstream sync ($REF)"
fi

echo "✓ synced with $REF. Test with: npm start   then push: git push origin atv/main"
