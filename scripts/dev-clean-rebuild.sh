#!/usr/bin/env bash

set -euo pipefail

# Dev clean + rebuild + start helper for Expo/Metro
# - Kills all Metro/Expo processes and frees common ports
# - Clears Metro and Watchman caches
# - Reinstalls node_modules and regenerates native projects
# - Installs iOS pods when available
# - Starts Expo dev server with dev client on a fixed port
#
# Usage:
#   bash scripts/dev-clean-rebuild.sh [--yes] [--port 8081] [--no-start] [--skip-prebuild] [--skip-pods]

PORT=8081
YES=false
DO_START=true
DO_PREBUILD=true
DO_PODS=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      YES=true
      shift
      ;;
    --port)
      PORT=${2:-8081}
      shift 2
      ;;
    --no-start)
      DO_START=false
      shift
      ;;
    --skip-prebuild)
      DO_PREBUILD=false
      shift
      ;;
    --skip-pods)
      DO_PODS=false
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f package.json ]]; then
  echo "Error: package.json not found. Run from project root." >&2
  exit 1
fi

echo "== VanishVoice: Dev Clean Rebuild =="
echo "Project: $ROOT_DIR"
echo "Port: $PORT"
echo "Prebuild: $DO_PREBUILD | Pods: $DO_PODS | Start: $DO_START"
echo
echo "Node: $(node -v 2>/dev/null || echo 'not found')"
echo "NPM:  $(npm -v 2>/dev/null || echo 'not found')"
echo "Expo CLI: $(npx -y expo --version 2>/dev/null || echo 'not found')"
echo

if [[ "$YES" != true ]]; then
  read -r -p "This will delete node_modules, lockfiles, iOS Pods. Continue? [y/N] " resp
  case "$resp" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

echo "-- Killing Metro/Expo processes --"
pkill -f "metro|expo .*start|react-native .*start" 2>/dev/null || true

echo "-- Freeing common Expo/Metro ports --"
if command -v npx >/dev/null 2>&1; then
  npx -y kill-port 8081 8082 8083 19000 19001 19002 2>/dev/null || true
fi

echo "-- Clearing Watchman and Metro caches --"
if command -v watchman >/dev/null 2>&1; then
  watchman watch-del-all 2>/dev/null || true
fi
rm -rf "${TMPDIR:-/tmp}"/metro-* 2>/dev/null || true

echo "-- Removing node_modules and lockfiles --"
rm -rf node_modules package-lock.json 2>/dev/null || true

echo "-- Removing iOS Pods (if present) --"
rm -rf ios/Pods ios/Podfile.lock 2>/dev/null || true

echo "-- Installing dependencies --"
npm install

echo "-- Expo doctor (non-fatal) --"
npx -y expo-doctor || true

echo "-- Ensuring React Native version is aligned --"
npx -y expo install react-native || true

if [[ "$DO_PREBUILD" == true ]]; then
  echo "-- Expo prebuild (clean) --"
  npx -y expo prebuild --clean
fi

if [[ "$DO_PODS" == true ]]; then
  if command -v npx >/dev/null 2>&1; then
    echo "-- Installing iOS pods --"
    npx -y pod-install ios || true
  fi
fi

echo "-- Summary: key versions --"
npm ls --depth=0 expo react react-native metro metro-config metro-resolver || true

if [[ "$DO_START" == true ]]; then
  echo
  echo "-- Starting Expo (dev client) on port $PORT --"
  echo "Tip: scan the QR printed for port $PORT and uninstall older dev clients first if needed."
  EXPO_DEBUG=1 npx -y expo start --dev-client --port "$PORT" --clear
else
  echo "Done. Skipped start per flags."
fi

