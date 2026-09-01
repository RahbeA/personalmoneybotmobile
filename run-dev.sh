#!/usr/bin/env bash
# MoneyBot local dev runner.
# Requires a native dev-client build (not Expo Go). First time on iOS:
#   cd mobile && npx expo run:ios
# Or cloud dev build:
#   cd mobile && npx eas-cli build --profile development --platform ios
#
# Usage:
#   ./run-dev.sh                  # local backend + Metro (simulator → localhost:8000)
#   ./run-dev.sh --production-api # Metro only; app hits Railway (use on a real iPhone)
#   ./run-dev.sh --mobile-only    # skip backend/web (when using production API)


set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCTION_API=0
MOBILE_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --production-api) PRODUCTION_API=1 ;;
    --mobile-only) MOBILE_ONLY=1 ;;
    *) echo "Unknown option: $arg"; echo "Usage: ./run-dev.sh [--production-api] [--mobile-only]"; exit 1 ;;
  esac
done

if [ "$MOBILE_ONLY" = 0 ] && [ "$PRODUCTION_API" = 0 ]; then
  echo "==> Killing existing processes on ports 8000, 5173 and 8083..."
  lsof -ti tcp:8000 | xargs kill -9 2>/dev/null || true
  lsof -ti tcp:5173 | xargs kill -9 2>/dev/null || true
else
  echo "==> Killing existing Metro on port 8083..."
fi
lsof -ti tcp:8083 | xargs kill -9 2>/dev/null || true

BACKEND_PID=""
WEB_PID=""

if [ "$MOBILE_ONLY" = 0 ] && [ "$PRODUCTION_API" = 0 ]; then
  PYTHON="$ROOT/backend/venv/bin/python"
  if [ ! -x "$PYTHON" ]; then
    echo "ERROR: backend venv missing. Use Python 3.13:"
    echo "  cd backend && python3.13 -m venv venv && ./venv/bin/pip install -r requirements.txt"
    exit 1
  fi
  PY_VER="$("$PYTHON" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
  if [ "$PY_VER" = "3.14" ]; then
    echo "ERROR: backend venv is Python $PY_VER — psycopg does not support 3.14 yet. Recreate with Python 3.13."
    exit 1
  fi

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
fi

cleanup() {
  echo "==> Stopping services..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Starting Expo dev client on http://127.0.0.1:8083 ..."
cd "$ROOT/mobile"
export REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1
if [ "$PRODUCTION_API" = 1 ]; then
  export EXPO_PUBLIC_USE_PRODUCTION_API=1
  echo "    API: production (Railway)"
else
  echo "    API: local (http://localhost:8000/api) — use --production-api on a physical iPhone"
fi
npx expo start --dev-client --port 8083 --clear --ios
