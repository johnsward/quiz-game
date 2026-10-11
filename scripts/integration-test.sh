#!/usr/bin/env bash
# End-to-end check through nginx -> backend -> Postgres. Usage: integration-test.sh <base-url>
set -euo pipefail
base="${1:?base url required}"
name="ci-$(date +%s)"

# score must fit the game rules: 100-200 points per correct answer.
resp=$(curl -fsS -X POST "$base/api/scores" -H 'Content-Type: application/json' \
  -d "{\"name\":\"$name\",\"score\":100,\"correct\":1}")
echo "created: $resp"
curl -fsS "$base/api/leaderboard?limit=50" | grep -q "$name" \
  || { echo "score not found on leaderboard"; exit 1; }
echo "integration test OK"
