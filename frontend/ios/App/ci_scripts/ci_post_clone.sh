#!/bin/sh
set -e

echo "=== Installing Node.js via Homebrew ==="
brew install node@20
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

echo "=== Installing Node dependencies ==="
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"
npm ci

echo "=== Building web bundle ==="
npm run build

echo "=== Syncing Capacitor ==="
npx cap sync ios

echo "=== Done ==="
