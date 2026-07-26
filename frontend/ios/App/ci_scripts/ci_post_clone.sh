#!/bin/sh
set -e

# Xcode Cloud clones the repo without node_modules.
# This script installs dependencies and builds the web bundle
# so the local SPM package paths in Package.swift resolve correctly.

echo "=== Installing Node dependencies ==="
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"
npm ci

echo "=== Building web bundle ==="
npm run build

echo "=== Syncing Capacitor ==="
npx cap sync ios

echo "=== Done ==="
