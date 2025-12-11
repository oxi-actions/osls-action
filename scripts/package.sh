#!/bin/bash
set -euo pipefail

# Create dist directory
mkdir -p dist

# Create a temporary directory for clean install
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "Installing production dependencies in $TEMP_DIR..."
# Initialize a dummy package.json
cd "$TEMP_DIR"
npm init -y > /dev/null
# Install osls (and punycode if needed)
npm install osls@3.61 punycode --no-save --omit=dev

# Create the tarball
echo "Creating osls_node_modules.tgz..."
tar -czf "$OLDPWD/dist/osls_node_modules.tgz" node_modules

echo "Done."
