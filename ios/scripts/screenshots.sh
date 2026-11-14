#!/bin/sh
# Builds the app, runs the screenshot harness (ios/SisuUITests) on the "iPhone 17 Pro" simulator and exports
# every screenshot to ios/.derived-app/screens/<name>.png.
#
# Usage (from the repository root):
#   sh ios/scripts/screenshots.sh                    # every shot
#   SISU_SHOTS=picker,jars sh ios/scripts/screenshots.sh   # only shots whose name contains one of these
#
# Uses only xcodebuild's test runner and xcresulttool. Writes inside ios/.derived-app, the Swift package
# cache and Xcode's own caches. Exit status: 0 when the screenshots were exported, 1 otherwise.

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd) || exit 1
cd "$ROOT" || exit 1

DEVICE=${SISU_DEVICE:-iPhone 17 Pro}
DERIVED=${SISU_DERIVED:-ios/.derived-app}
RESULT=$DERIVED/screenshots.xcresult
LOG=$DERIVED/screenshots.log
OUT=$DERIVED/screens
RAW=$DERIVED/screens-raw
mkdir -p "$DERIVED" || exit 1
rm -rf "$RESULT" "$RAW" "$OUT"
mkdir -p "$OUT" "$RAW" || exit 1

TEST_RUNNER_SISU_SHOTS=${SISU_SHOTS:-} xcodebuild test \
    -project ios/Sisu.xcodeproj \
    -scheme SisuScreens \
    -destination "platform=iOS Simulator,name=$DEVICE" \
    -derivedDataPath "$DERIVED" \
    -resultBundlePath "$RESULT" \
    -only-testing:"${SISU_ONLY:-SisuUITests/ScreenshotTests}" \
    -clonedSourcePackagesDirPath "$HOME/Library/Caches/sisu-ios-packages" \
    -disableAutomaticPackageResolution \
    -skipPackagePluginValidation \
    -IDEPackageSupportDisableManifestSandbox=YES \
    -IDEPackageSupportDisablePluginExecutionSandbox=YES \
    -parallel-testing-enabled NO \
    CODE_SIGNING_ALLOWED=NO >"$LOG" 2>&1
status=$?

if [ ! -d "$RESULT" ]; then
    echo "screenshots: FAILED, no result bundle. Last lines of $LOG:" >&2
    grep -E "error:|\*\* " "$LOG" | tail -n 30 >&2
    tail -n 20 "$LOG" >&2
    exit 1
fi

xcrun xcresulttool export attachments --path "$RESULT" --output-path "$RAW" >/dev/null 2>&1 || {
    echo "screenshots: FAILED to export attachments from $RESULT" >&2
    exit 1
}

# manifest.json maps each exported file to the attachment's name ("<name>_<n>_<uuid>.png").
python3 - "$RAW" "$OUT" "$ROOT" <<'PY'
import json, os, re, shutil, sys
raw, out, root = sys.argv[1:4]
def walk(node):
    if isinstance(node, dict):
        if "exportedFileName" in node:
            yield node
        for value in node.values():
            yield from walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk(value)
for item in walk(json.load(open(os.path.join(raw, "manifest.json")))):
    human = item.get("suggestedHumanReadableName") or item["exportedFileName"]
    name = re.sub(r"_\d+_[0-9A-Fa-f-]+\.\w+$", "", human)
    name = re.sub(r"\.\w+$", "", name)
    target = os.path.join(out, name + ".png")
    shutil.copyfile(os.path.join(raw, item["exportedFileName"]), target)
    print(os.path.join(root, target))
PY

if [ "$status" -ne 0 ]; then
    echo "screenshots: the test run reported a failure (xcodebuild exit $status); see $LOG" >&2
    grep -E "error:|failed" "$LOG" | tail -n 20 >&2
fi
exit 0
