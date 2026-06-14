#!/bin/bash
set -e

# ==========================================
# GENERAL CONFIGURATION
# ==========================================
INSTALL_DIR="$HOME/.local/bin"
COMMAND_NAME="nodepi"

echo "Installing NodePi-tui..."

# ==========================================
# 1. DETECT SYSTEM AND ARCHITECTURE
# ==========================================
OS="$(uname -s)"
ARCH="$(uname -m)"
TARGET=""

case "$OS" in
  Darwin)
    if [ "$ARCH" = "arm64" ]; then
      TARGET="nodepi-darwin-arm64"
    else
      TARGET="nodepi-darwin-x64"
    fi
    ;;
  Linux)
    if [ "$ARCH" = "x86_64" ]; then
      TARGET="nodepi-linux-x64"
    else
      echo "Error: Unsupported Linux architecture ($ARCH)"
      exit 1
    fi
    ;;
  *)
    echo "Error: Unsupported operating system ($OS)"
    exit 1
    ;;
esac

# ==========================================
# 2. VALIDATE BINARY
# ==========================================
BIN_PATH="bin/$TARGET"

if [ ! -f "$BIN_PATH" ]; then
  echo "Error: Compiled executable not found at: $BIN_PATH"
  echo "Run 'pnpm run build-bin' first to generate it."
  exit 1
fi

# ==========================================
# 3. INSTALLATION
# ==========================================
mkdir -p "$INSTALL_DIR"
cp "$BIN_PATH" "$INSTALL_DIR/$COMMAND_NAME"
chmod +x "$INSTALL_DIR/$COMMAND_NAME"

echo "Installation complete. The '$COMMAND_NAME' command is ready to use."
