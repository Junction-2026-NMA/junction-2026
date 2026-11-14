#!/bin/sh
# Runs the hosted tests (ios/SisuTests) inside the app on an iOS Simulator, and prints the Rive contract report.
#
# Usage (from the repository root):
#   sh ios/scripts/test-app.sh                 # on "iPhone 17 Pro"
#   sh ios/scripts/test-app.sh "iPhone 17"     # on another simulator
#
# The Rive contract test is skipped until ios/Sisu/Resources/Rive/sisu_ui.riv exists.
#
# Xcode now and then starts the tests on a copy of the app that the simulator installed in an earlier run:
# everything passes, but a new test or a new .riv is silently not part of it. So the tests print a checksum of
# the files they run from (RunFingerprintTests), this script compares them with what it has just built, and
# runs once more when they differ.
#
# Writes only inside the repository (ios/.derived), the Swift package cache and Xcode's own caches.
# Exit status: 0 when every test passed or was skipped, 1 otherwise.

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd) || exit 1
cd "$ROOT" || exit 1

DEVICE=${1:-iPhone 17 Pro}
DERIVED=ios/.derived
LOG=$DERIVED/test-app.log
APP=$DERIVED/Build/Products/Debug-iphonesimulator/Sisu.app
mkdir -p "$DERIVED" || exit 1

run_tests() {
    xcodebuild test \
        -project ios/Sisu.xcodeproj \
        -scheme Sisu \
        -destination "platform=iOS Simulator,name=$DEVICE" \
        -derivedDataPath "$DERIVED" \
        -clonedSourcePackagesDirPath "$HOME/Library/Caches/sisu-ios-packages" \
        -disableAutomaticPackageResolution \
        -skipPackagePluginValidation \
        -IDEPackageSupportDisableManifestSandbox=YES \
        -IDEPackageSupportDisablePluginExecutionSandbox=YES \
        -parallel-testing-enabled NO \
        -test-timeouts-enabled YES \
        CODE_SIGNING_ALLOWED=NO >"$LOG" 2>&1
}

# True when the tests ran at all.
tests_ran() {
    grep -q "^Test Suite 'All tests' started" "$LOG"
}

# True when every file the tests say they ran from is the file that was just built.
ran_this_build() {
    grep '^\[RunFingerprint\] ' "$LOG" >"$LOG.fingerprint" || return 1
    while read -r tag digest path; do
        built=$(shasum -a 256 "$APP/$path" 2>/dev/null | cut -d ' ' -f 1)
        [ "$built" = "$digest" ] || return 1
    done <"$LOG.fingerprint"
    return 0
}

run_tests
status=$?
if tests_ran && ! ran_this_build; then
    echo "test-app: the simulator ran an older copy of the app. Running the tests once more." >&2
    run_tests
    status=$?
    if tests_ran && ! ran_this_build; then
        echo "test-app: FAILED. The simulator ran an older copy of the app twice, so these results are not for this build (log: $LOG)." >&2
        exit 1
    fi
fi

# The lines that matter: the Rive contract report, every test case, and the totals.
grep -E '^\[RiveContract\]|^Test Case .* (passed|failed|skipped)|: error: |Executed [0-9]+ tests?|^\*\* TEST' "$LOG"

if [ "$status" -ne 0 ]; then
    echo "test-app: FAILED (xcodebuild exit $status). Last lines of $LOG:" >&2
    tail -n 40 "$LOG" >&2
    exit 1
fi
echo "test-app: OK (log: $LOG)"
