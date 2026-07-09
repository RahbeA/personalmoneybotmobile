#!/usr/bin/env bash
# MoneyBot local dev runner.
# Kills anything on the backend (8000) and Expo (8083) ports, then starts both.
# Usage: ./run-dev.sh   (from the moneybotmobile repo root)

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Killing existing processes on ports 8000 and 8083..."
lsof -ti tcp:8000 | xargs kill -9 2>/dev/null || true
lsof -ti tcp:8083 | xargs kill -9 2>/dev/null || true

echo "==> Starting Django backend on http://localhost:8000 ..."
cd "$ROOT/backend"
./venv/bin/python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!

# Stop the backend when this script is stopped (Ctrl+C).
trap 'echo "==> Stopping backend..."; kill $BACKEND_PID 2>/dev/null || true' EXIT

echo "==> Starting Expo (mobile) on http://localhost:8083 ..."
cd "$ROOT/mobile"
npx expo start --dev-client --port 8083 -c
