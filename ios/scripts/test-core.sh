#!/bin/sh
# Runs every test of the SisuCore package on this Mac (no simulator, no network).
#
# Usage (from the repository root):
#   sh ios/scripts/test-core.sh
#
# Extra arguments go to `swift test`, for example: sh ios/scripts/test-core.sh --filter MoneyTests
# Writes only inside ios/SisuCore/.build and the Swift toolchain's own caches.

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd) || exit 1

exec swift test --disable-sandbox --package-path "$ROOT/ios/SisuCore" "$@"
