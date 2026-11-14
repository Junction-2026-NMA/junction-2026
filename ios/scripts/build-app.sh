#!/bin/sh
# Builds the Sisu app for the iOS Simulator into ios/.derived-app (the screens' own derived data) and prints
# the errors when it fails. Same package flags as build-check.sh.
#
# Usage (from the repository root): sh ios/scripts/build-app.sh
set -u
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd) || exit 1
cd "$ROOT" || exit 1
DERIVED=${SISU_DERIVED:-ios/.derived-app}
LOG=$DERIVED/build-app.log
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
    echo "build-app: OK (log: $LOG)"
    exit 0
fi
echo "build-app: FAILED (log: $LOG)" >&2
grep -E ": error: " "$LOG" | sort -u | head -n 40 >&2
exit 1
