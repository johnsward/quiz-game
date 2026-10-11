#!/usr/bin/env bash
# Smoke test a deployed environment. Usage: smoke-test.sh <base-url>
set -euo pipefail
base="${1:?base url required}"

retry() { for _ in $(seq 1 15); do "$@" && return 0; sleep 2; done; return 1; }

echo "frontend /healthz"; retry curl -fsS "$base/healthz"
echo "backend /api/health"; retry curl -fsS "$base/api/health"
echo "leaderboard"; curl -fsS "$base/api/leaderboard?limit=1" >/dev/null
echo "smoke test OK"
