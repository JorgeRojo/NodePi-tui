#!/bin/bash
set -e

NODE_VERSION="v20.11.0"
TARGETS=("darwin-arm64" "darwin-x64" "linux-x64")
DIST_DIR="dist"
BIN_DIR="bin"
TEMP_DIR="temp_build"

# Detect host target
HOST_OS="$(uname -s)"
HOST_ARCH="$(uname -m)"
if [ "$HOST_OS" = "Darwin" ]; then
  if [ "$HOST_ARCH" = "arm64" ]; then HOST_TARGET="darwin-arm64"; else HOST_TARGET="darwin-x64"; fi
else
  HOST_TARGET="linux-x64"
fi

mkdir -p "$BIN_DIR"
mkdir -p "$TEMP_DIR"
mkdir -p "$DIST_DIR"

echo "📦 Bundling app with esbuild..."
npx esbuild src/index.tsx --bundle --platform=node --format=cjs --banner:js="var _a;" --outfile="$DIST_DIR/bundle.js"

echo "⚙️  Creating SEA config..."
cat <<EOF > sea-config.json
{
  "main": "$DIST_DIR/bundle.js",
  "output": "$DIST_DIR/sea-prep.blob",
  "disableExperimentalSEAWarning": true
}
EOF

# Ensure host node is downloaded first to generate the blob
HOST_TARBALL="node-${NODE_VERSION}-${HOST_TARGET}.tar.gz"
HOST_URL="https://nodejs.org/dist/${NODE_VERSION}/${HOST_TARBALL}"
if [ ! -f "${TEMP_DIR}/${HOST_TARBALL}" ]; then
  echo "📥 Downloading host node for blob generation..."
  curl -# -L -o "${TEMP_DIR}/${HOST_TARBALL}" "$HOST_URL"
  tar -xzf "${TEMP_DIR}/${HOST_TARBALL}" -C "$TEMP_DIR" "node-${NODE_VERSION}-${HOST_TARGET}/bin/node"
fi

HOST_NODE="${TEMP_DIR}/node-${NODE_VERSION}-${HOST_TARGET}/bin/node"

echo "💧 Generating SEA prep blob using node ${NODE_VERSION}..."
"$HOST_NODE" --experimental-sea-config sea-config.json

for target in "${TARGETS[@]}"; do
  echo -e "\n🚀 Processing target: $target"
  TARBALL="node-${NODE_VERSION}-${target}.tar.gz"
  URL="https://nodejs.org/dist/${NODE_VERSION}/${TARBALL}"
  TARBALL_PATH="${TEMP_DIR}/${TARBALL}"

  if [ ! -f "$TARBALL_PATH" ]; then
    echo "📥 Downloading $TARBALL..."
    curl -# -L -o "$TARBALL_PATH" "$URL"
    tar -xzf "$TARBALL_PATH" -C "$TEMP_DIR" "node-${NODE_VERSION}-${target}/bin/node"
  fi

  EXTRACTED_NODE="${TEMP_DIR}/node-${NODE_VERSION}-${target}/bin/node"
  FINAL_BINARY="${BIN_DIR}/nodepi-${target}"
  
  cp "$EXTRACTED_NODE" "$FINAL_BINARY"
  chmod 755 "$FINAL_BINARY"

  echo "💉 Injecting SEA blob..."
  POSTJECT_ARGS=( "$FINAL_BINARY" "NODE_SEA_BLOB" "$DIST_DIR/sea-prep.blob" "--sentinel-fuse" "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2" "--overwrite" )

  if [[ "$target" == *"darwin"* ]]; then
    POSTJECT_ARGS+=("--macho-segment-name" "NODE_SEA")
  fi

  npx postject "${POSTJECT_ARGS[@]}"

  if [[ "$target" == *"darwin"* ]]; then
    echo "🔐 Signing macOS binary..."
    codesign --sign - "$FINAL_BINARY"
  fi

  echo "✅ Binary created: $FINAL_BINARY"
done

echo -e "\n🧹 Cleaning up..."
rm -rf "$TEMP_DIR"
rm -f sea-config.json

echo "🎉 All binaries built successfully in the /bin folder!"
