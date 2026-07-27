#!/bin/sh
set -e

# Skip Homebrew auto-update (avoid CI timeout/failure)
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1

# Ensure Homebrew is on PATH (Apple Silicon)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "=== Installing Node.js ==="
brew install node@20
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
echo "Node: $(node --version), npm: $(npm --version)"

echo "=== Installing dependencies ==="
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"
npm ci

echo "=== Building web bundle ==="
npm run build

echo "=== Syncing Capacitor ==="
npx cap sync ios

echo "=== Done ==="
