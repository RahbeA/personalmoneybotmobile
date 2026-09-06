#!/usr/bin/env bash
# Dedicated local runner for the mobile app — uses its own ports so it does not
# conflict with other dev servers (8000/8083, Cursor, etc.).
#
# Usage (from repo root):
#   ./run-mobile-local.sh              # simulator / same machine
#   ./run-mobile-local.sh --device     # physical iPhone on same Wi‑Fi
#
# Backend:  http://localhost:8010/api  (simulator)
# Expo:     http://127.0.0.1:8090
# Phone:    set API to http://<your-mac-ip>:8010/api via --device

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=8010
EXPO_PORT=8090
USE_DEVICE=0

if [[ "${1:-}" == "--device" ]]; then
  USE_DEVICE=1
fi

if [[ "$USE_DEVICE" == "1" ]]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  if [[ -z "$LAN_IP" ]]; then
    echo "Could not detect your Mac's Wi‑Fi IP. Connect to Wi‑Fi and retry."
    exit 1
  fi
  export EXPO_PUBLIC_LOCAL_API_URL="http://${LAN_IP}:${BACKEND_PORT}/api"
  export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
  echo "==> Physical device mode"
  echo "    API:      $EXPO_PUBLIC_LOCAL_API_URL"
  echo "    Metro:    http://${LAN_IP}:${EXPO_PORT}"
else
  export EXPO_PUBLIC_LOCAL_API_URL="http://localhost:${BACKEND_PORT}/api"
  export REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1
  echo "==> Simulator / local mode"
  echo "    API:      $EXPO_PUBLIC_LOCAL_API_URL"
  echo "    Metro:    http://127.0.0.1:${EXPO_PORT}"
fi

if lsof -i "tcp:${BACKEND_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "==> Backend already listening on port ${BACKEND_PORT} (leaving it running)"
else
  echo "==> Starting Django backend on port ${BACKEND_PORT} ..."
  cd "$ROOT/backend"
  ./venv/bin/python manage.py runserver "0.0.0.0:${BACKEND_PORT}" &
  BACKEND_PID=$!
  trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT
fi

echo "==> Starting Expo dev client on port ${EXPO_PORT} ..."
cd "$ROOT/mobile"
npx expo start --dev-client --port "$EXPO_PORT"
