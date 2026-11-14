#!/bin/sh
# Runs ONE XCTest file of the SisuCore package and writes a JUnit report.
#
# Usage (from the repository root):
#   sh ios/scripts/swift-test-file.sh <test-file> <junit-report>
#
#   <test-file>     a Swift file under ios/SisuCore/Tests/SisuCoreTests/
#   <junit-report>  where the JUnit XML report is written (replaced if it exists)
#
# The test class must be named after its file. The rule:
#   1. take the file name and drop the final ".swift";
#   2. replace every character that is not an ASCII letter, a digit or "_" with "_"
#      (so "." and "-" both become "_");
#   3. if the result starts with a digit, put "_" in front.
# Examples:
#   ModelsDecodingTests.swift  ->  ModelsDecodingTests
#   money-format.hidden.swift  ->  money_format_hidden
#   2026-scenario.swift        ->  _2026_scenario
# The file must declare `class <Name>` (an XCTestCase subclass). Only the tests of that class run.
# All test files are compiled, as in any `swift test`, so the file may use helpers from other test files.
#
# It runs:
#   swift test --disable-sandbox --package-path ios/SisuCore --filter "\.<Name>/" --xunit-output <junit-report> \
#       --parallel --num-workers 1 --disable-swift-testing
# - The filter is the pattern "\.<Name>/", so a class whose name merely contains <Name> does not run as well.
# - `--parallel` is required: without it SwiftPM (Swift 6.3) writes no XCTest results to the report at all.
#   `--num-workers 1` still runs the tests one after the other, each in its own process.
# - `--disable-swift-testing` skips the Swift Testing pass, which would only add an empty second report.
#
# Inside a sandbox that denies writes to the user's temporary folder, SwiftPM cannot build at all (it writes
# files through <temp folder>/TemporaryItems and ignores TMPDIR). The script notices this and uses
# ios/scripts/swift-test-direct.sh instead, which compiles with swiftc and runs the class with xctest.
# Set SISU_SWIFT_TEST_DIRECT=1 to force that path.
#
# Exit status:
#   0  every test of the class passed, and the report lists them
#   1  the package did not build, or a test failed
#   2  wrong usage, the class is not in the file, or the report holds no test case of the class

set -u

fail() {
    echo "swift-test-file: $1" >&2
    exit 2
}

[ "$#" -eq 2 ] || fail "usage: sh ios/scripts/swift-test-file.sh <test-file> <junit-report>"

TEST_FILE=$1
REPORT=$2

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P) || exit 2
PACKAGE=$ROOT/ios/SisuCore
TESTS_DIR=$PACKAGE/Tests/SisuCoreTests

[ -f "$TEST_FILE" ] || fail "test file not found: $TEST_FILE"
case "$TEST_FILE" in
    *.swift) ;;
    *) fail "not a Swift file: $TEST_FILE" ;;
esac

FILE_DIR=$(CDPATH= cd -- "$(dirname -- "$TEST_FILE")" && pwd -P) || fail "cannot open the folder of $TEST_FILE"
case "$FILE_DIR/" in
    "$TESTS_DIR"/*) ;;
    *) fail "$TEST_FILE is not under ios/SisuCore/Tests/SisuCoreTests/" ;;
esac

# The class name, by the rule at the top of this file.
STEM=${TEST_FILE##*/}
STEM=${STEM%.swift}
CLASS=$(printf '%s' "$STEM" | LC_ALL=C sed 's/[^A-Za-z0-9_]/_/g')
case "$CLASS" in
    [0-9]*) CLASS=_$CLASS ;;
esac
[ -n "$CLASS" ] || fail "cannot derive a class name from $TEST_FILE"

if ! LC_ALL=C grep -Eq "(^|[^A-Za-z0-9_])class[[:space:]]+$CLASS([^A-Za-z0-9_]|\$)" "$TEST_FILE"; then
    fail "class $CLASS not found in $TEST_FILE. The test class must be named after the file (see the rule at the top of ios/scripts/swift-test-file.sh)."
fi

case "$REPORT" in
    /*) ;;
    *) REPORT=$PWD/$REPORT ;;
esac
mkdir -p "$(dirname -- "$REPORT")" || fail "cannot create the folder for $REPORT"
# Never leave an old report behind: a build failure must not look like yesterday's pass.
rm -f "$REPORT" || fail "cannot replace $REPORT"

# True when SwiftPM can write its build files here. It cannot when the user's temporary folder is closed to us.
swiftpm_can_build() {
    user_temp=$(getconf DARWIN_USER_TEMP_DIR 2>/dev/null) || return 0
    [ -n "$user_temp" ] || return 0
    probe=${user_temp%/}/sisu-swift-test-file.$$
    if (: >"$probe") 2>/dev/null; then
        rm -f "$probe"
        return 0
    fi
    return 1
}

if [ "${SISU_SWIFT_TEST_DIRECT:-0}" = 1 ] || ! swiftpm_can_build; then
    echo "swift-test-file: SwiftPM cannot build here (the user's temporary folder is not writable, or SISU_SWIFT_TEST_DIRECT=1). Using swiftc and xctest directly." >&2
    sh "$ROOT/ios/scripts/swift-test-direct.sh" "$CLASS" "$REPORT"
    STATUS=$?
else
    swift test --disable-sandbox --package-path "$PACKAGE" --filter "\\.$CLASS/" --xunit-output "$REPORT" \
        --parallel --num-workers 1 --disable-swift-testing
    STATUS=$?
fi

if [ ! -s "$REPORT" ]; then
    echo "swift-test-file: no JUnit report was written to $REPORT (exit $STATUS). The package probably did not build." >&2
    [ "$STATUS" -ne 0 ] && exit 1
    exit 2
fi

CASES=$(LC_ALL=C grep -Eo "<testcase[^>]*classname=\"([^\"]*\\.)?$CLASS\"" "$REPORT" | wc -l | tr -d ' ')
if [ "$CASES" -eq 0 ]; then
    echo "swift-test-file: the report $REPORT holds no test case of class $CLASS. Does the class have test methods?" >&2
    [ "$STATUS" -ne 0 ] && exit 1
    exit 2
fi

if [ "$STATUS" -ne 0 ]; then
    echo "swift-test-file: $CLASS FAILED ($CASES test cases in $REPORT)" >&2
    exit 1
fi
echo "swift-test-file: $CLASS passed ($CASES test cases in $REPORT)"
