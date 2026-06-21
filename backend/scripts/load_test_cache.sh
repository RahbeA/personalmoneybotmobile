#!/usr/bin/env bash
# Load-test boot + leaderboard endpoints against staging/production.
# Usage:
#   API_BASE=https://moneybotmobile-production.up.railway.app/api TOKEN=abc ./backend/scripts/load_test_cache.sh
#
# Requires: hey (go install github.com/rakyll/hey@latest)

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000/api}"
TOKEN="${TOKEN:?Set TOKEN to a valid auth token}"

echo "=== Boot sequence (stats + modules + characters) ==="
hey -n 150 -c 50 -H "Authorization: Token ${TOKEN}" "${API_BASE}/courses/stats/"
hey -n 150 -c 50 -H "Authorization: Token ${TOKEN}" "${API_BASE}/courses/modules/"
hey -n 150 -c 50 -H "Authorization: Token ${TOKEN}" "${API_BASE}/moneyverse/characters/"

echo "=== Leaderboard page 1 ==="
hey -n 100 -c 20 -H "Authorization: Token ${TOKEN}" "${API_BASE}/courses/leaderboard/?page=1&page_size=20"

echo "Done. Check p95 latency and X-Cache-Status: HIT on repeat leaderboard requests."
