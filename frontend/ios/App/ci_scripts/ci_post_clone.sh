#!/bin/sh
set -e

# Ensure Homebrew is on PATH (Apple Silicon path)
export PATH="/opt/homebrew/bin:$PATH"

echo "=== Installing Node.js via Homebrew ==="
# Install or upgrade node@20; don't fail if already at latest
brew install node@20 || brew upgrade node@20 || true
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# Verify node is usable
node --version
npm --version

echo "=== Installing Node dependencies ==="
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"
npm ci

echo "=== Building web bundle ==="
npm run build

echo "=== Syncing Capacitor ==="
npx cap sync ios

echo "=== Done ==="
