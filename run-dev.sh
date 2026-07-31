#!/usr/bin/env bash
# MoneyBot local dev runner.
# Kills anything on the backend (8000), web admin (5173) and Expo (8083) ports,
# then starts all three. Usage: ./run-dev.sh   (from the moneybotmobile repo root)

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Killing existing processes on ports 8000, 5173 and 8083..."
lsof -ti tcp:8000 | xargs kill -9 2>/dev/null || true
lsof -ti tcp:5173 | xargs kill -9 2>/dev/null || true
lsof -ti tcp:8083 | xargs kill -9 2>/dev/null || true

echo "==> Starting Django backend on http://localhost:8000 ..."
cd "$ROOT/backend"
./venv/bin/python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!

echo "==> Starting web admin panel on http://localhost:5173/panel/ ..."
cd "$ROOT/web"
if [ ! -d node_modules ]; then
  echo "    (installing web dependencies, first run only)"
  npm install
fi
npm run dev -- --host &
WEB_PID=$!

# Stop the backend and web admin when this script is stopped (Ctrl+C).
trap 'echo "==> Stopping backend and web admin..."; kill $BACKEND_PID $WEB_PID 2>/dev/null || true' EXIT

echo "==> Starting Expo (mobile) on http://localhost:8083 ..."
cd "$ROOT/mobile"
npx expo start --dev-client --port 8083 -c
