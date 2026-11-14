#!/bin/sh
# Builds the Sisu app for the iOS Simulator and says whether it compiled.
#
# Usage (from the repository root):
#   sh ios/scripts/build-check.sh
#
# Writes only inside the repository (ios/.derived), the Swift package cache
# ($HOME/Library/Caches/sisu-ios-packages) and Xcode's own caches.
# The first run needs the network once, to fetch the Rive runtime into that cache.
# Exit status: 0 when the build succeeded, 1 when it failed (the end of the log is printed).

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd) || exit 1
cd "$ROOT" || exit 1

DERIVED=ios/.derived
LOG=$DERIVED/build-check.log
mkdir -p "$DERIVED" || exit 1

if xcodebuild build \
    -project ios/Sisu.xcodeproj \
    -scheme Sisu \
    -configuration Debug \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$DERIVED" \
    -clonedSourcePackagesDirPath "$HOME/Library/Caches/sisu-ios-packages" \
    -disableAutomaticPackageResolution \
    -skipPackagePluginValidation \
    -IDEPackageSupportDisableManifestSandbox=YES \
    -IDEPackageSupportDisablePluginExecutionSandbox=YES \
    CODE_SIGNING_ALLOWED=NO \
    -quiet >"$LOG" 2>&1
then
    echo "build-check: OK (log: $LOG)"
    exit 0
fi

echo "build-check: FAILED. Last lines of $LOG:" >&2
tail -n 60 "$LOG" >&2
exit 1
