#!/bin/sh
# Builds the Sisu component library:
#   rive/sisu-ui  ->  ios/Sisu/Resources/Rive/sisu_ui.riv
# Run from the repository root:  sh rive/build.sh
# Needs the Rive CLI (`rive`). No login and no network: the file has no scripts, so it ships unsigned.
set -eu

export RIVE_ANALYTICS=off
export RIVE_NO_TUI=1

SRC=rive/sisu-ui
OUT=ios/Sisu/Resources/Rive/sisu_ui.riv

if [ ! -f "$SRC/rive.yaml" ]; then
    echo "build.sh: $SRC/rive.yaml not found. Run this from the repository root." >&2
    exit 1
fi
if ! command -v rive >/dev/null 2>&1; then
    echo "build.sh: the Rive CLI (rive) is not on PATH." >&2
    exit 1
fi

# 1. Check the sources compile and the result would load.
rive "$SRC" --verify

# 2. Build an unsigned .riv into rive/sisu-ui/build/.
rive "$SRC" --once

# 3. Copy it to where the iOS app bundles it.
mkdir -p "$(dirname "$OUT")"
cp "$SRC/build/sisu_ui.riv" "$OUT"
echo "built $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
