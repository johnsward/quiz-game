#!/usr/bin/env bash
# Work out the next release version for a pull request. Prints X.Y.Z, or explains and exits 1.
# Usage: next-version.sh "<comma-separated PR labels>"
# The PR needs exactly one label: release:major | release:minor | release:patch.
# It bumps the latest v* tag (starting from v0.0.0 if there is none).
# Needs the repository's tags (checkout with fetch-depth: 0).
set -euo pipefail
labels="${1:-}"

latest="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' | sort -V | tail -1)"
current="${latest:-v0.0.0}"
current="${current#v}"

bumps="$(printf '%s' "$labels" | tr ',' '\n' | grep -E '^release:(major|minor|patch)$' || true)"
count="$(printf '%s' "$bumps" | grep -c . || true)"
if [ "$count" -ne 1 ]; then
  echo "Set exactly one label: release:major, release:minor or release:patch (found $count)." >&2
  exit 1
fi

IFS=. read -r major minor patch <<<"$current"
case "${bumps#release:}" in
  major) version="$((major + 1)).0.0" ;;
  minor) version="${major}.$((minor + 1)).0" ;;
  patch) version="${major}.${minor}.$((patch + 1))" ;;
esac
echo "$version"
