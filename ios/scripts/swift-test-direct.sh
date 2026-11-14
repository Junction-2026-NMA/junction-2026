#!/bin/sh
# Builds SisuCore and its tests with swiftc and runs ONE test class with xctest, without SwiftPM.
#
# You normally never call this yourself. ios/scripts/swift-test-file.sh calls it when SwiftPM cannot work:
# inside a sandbox that denies writes to the user's temporary folder. SwiftPM writes its build files
# atomically through Foundation, and a sandboxed Foundation does that through
# <user temp folder>/TemporaryItems, whatever TMPDIR says. swiftc and xctest do not need that folder.
#
# Usage (from anywhere):
#   sh ios/scripts/swift-test-direct.sh <TestClass> <junit-report>
#
# This script repeats ios/SisuCore/Package.swift by hand. If that file changes, change this script too:
#   - library target SisuCore: every .swift file under Sources/SisuCore, Swift 5 mode, macOS 14,
#     and the folder Sources/SisuCore/Fixtures as its resource bundle (what `Bundle.module` finds);
#   - test target SisuCoreTests: every .swift file under Tests/SisuCoreTests.
# It warns when Package.swift no longer says so.
#
# The class runs in one process, like a plain `swift test`. If a test crashes, the run ends there: the crashed
# test is reported as failed and the tests after it are not in the report.
#
# Everything is written under ios/SisuCore/.build/direct, plus the report.
# Exit status: 0 every test of the class passed; 1 the build failed or a test failed; 2 wrong usage.

set -u

fail() {
    echo "swift-test-direct: $1" >&2
    exit 1
}

if [ "$#" -ne 2 ]; then
    echo "swift-test-direct: usage: sh ios/scripts/swift-test-direct.sh <TestClass> <junit-report>" >&2
    exit 2
fi

CLASS=$1
REPORT=$2

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P) || exit 2
PACKAGE=$ROOT/ios/SisuCore
MODULE=SisuCore
TESTS=SisuCoreTests
OUT=$PACKAGE/.build/direct

for expected in '.copy("Fixtures")' 'swiftLanguageModes: [.v5]' '.macOS(.v14)'; do
    grep -Fq -- "$expected" "$PACKAGE/Package.swift" ||
        echo "swift-test-direct: warning: Package.swift no longer contains $expected. This script may be out of date." >&2
done

# Tools, looked up once. xcrun complains on stderr when it cannot save its lookup cache; that is harmless.
SWIFTC=$(xcrun --find swiftc 2>/dev/null) || fail "swiftc not found. Is Xcode installed and selected?"
XCTEST=$(xcrun --find xctest 2>/dev/null) || fail "xctest not found. Is Xcode installed and selected?"
SDK=$(xcrun --sdk macosx --show-sdk-path 2>/dev/null) || fail "the macOS SDK was not found"
PLATFORM=$(xcrun --sdk macosx --show-sdk-platform-path 2>/dev/null) || fail "the macOS platform folder was not found"
SDKROOT=$SDK
export SDKROOT
TARGET=$(uname -m)-apple-macosx14.0

rm -rf "$OUT"
mkdir -p "$OUT" || fail "cannot create $OUT"

# One quoted path per line, the way swiftc reads an @file.
list_sources() {
    find "$1" -type f -name '*.swift' | LC_ALL=C sort | sed 's/\\/\\\\/g; s/"/\\"/g; s/.*/"&"/'
}

# 1. The resource bundle and the accessor SwiftPM would have generated.
BUNDLE=$OUT/${MODULE}_${MODULE}.bundle
mkdir -p "$BUNDLE" || fail "cannot create $BUNDLE"
cp -R "$PACKAGE/Sources/$MODULE/Fixtures" "$BUNDLE/Fixtures" || fail "cannot copy the fixtures"
BUNDLE_LITERAL=$(printf '%s' "$BUNDLE" | sed 's/\\/\\\\/g; s/"/\\"/g')
cat >"$OUT/resource_bundle_accessor.swift" <<EOF
import Foundation

extension Foundation.Bundle {
    /// Written by ios/scripts/swift-test-direct.sh in place of SwiftPM's generated accessor.
    static let module: Bundle = Bundle(path: "$BUNDLE_LITERAL") ?? Bundle.main
}
EOF

# 2. SisuCore as a library that tests can import with @testable.
list_sources "$PACKAGE/Sources/$MODULE" >"$OUT/sources.txt"
printf '"%s"\n' "$(printf '%s' "$OUT/resource_bundle_accessor.swift" | sed 's/\\/\\\\/g; s/"/\\"/g')" >>"$OUT/sources.txt"
"$SWIFTC" -module-name "$MODULE" -swift-version 5 -Onone -enable-testing -parse-as-library \
    -DSWIFT_PACKAGE -DDEBUG -target "$TARGET" -sdk "$SDK" -module-cache-path "$OUT/ModuleCache" \
    -emit-module -emit-module-path "$OUT/$MODULE.swiftmodule" \
    -emit-library -o "$OUT/lib$MODULE.dylib" -Xlinker -install_name -Xlinker "$OUT/lib$MODULE.dylib" \
    @"$OUT/sources.txt" || fail "SisuCore did not compile"

# 3. The tests as an XCTest bundle.
XCT=$OUT/$TESTS.xctest
mkdir -p "$XCT/Contents/MacOS" || fail "cannot create $XCT"
list_sources "$PACKAGE/Tests/$TESTS" >"$OUT/tests.txt"
"$SWIFTC" -module-name "$TESTS" -swift-version 5 -Onone -parse-as-library \
    -DSWIFT_PACKAGE -DDEBUG -target "$TARGET" -sdk "$SDK" -module-cache-path "$OUT/ModuleCache" \
    -I "$OUT" -L "$OUT" -l"$MODULE" \
    -F "$PLATFORM/Developer/Library/Frameworks" -I "$PLATFORM/Developer/usr/lib" -L "$PLATFORM/Developer/usr/lib" \
    -Xlinker -bundle \
    -Xlinker -rpath -Xlinker "$PLATFORM/Developer/Library/Frameworks" \
    -Xlinker -rpath -Xlinker "$PLATFORM/Developer/usr/lib" \
    -emit-executable -o "$XCT/Contents/MacOS/$TESTS" \
    @"$OUT/tests.txt" || fail "the tests did not compile"

# 4. Run the one class and keep what XCTest prints.
LOG=$OUT/xctest.log
"$XCTEST" -XCTest "$TESTS.$CLASS" "$XCT" >"$LOG" 2>&1
STATUS=$?
cat "$LOG"

# 5. Turn XCTest's lines into the JUnit report (same shape as SwiftPM's --xunit-output).
awk '
function esc(s) {
    gsub(/&/, "\\&amp;", s); gsub(/</, "\\&lt;", s); gsub(/>/, "\\&gt;", s); gsub(/"/, "\\&quot;", s)
    return s
}
function remember(id) {
    if (!(id in seen)) { seen[id] = 1; order[++count] = id }
}
/^Test Case .-\[[^ ]+ [^]]+\]. started\.$/ {
    id = $0; sub(/^Test Case .-\[/, "", id); sub(/\]. started\.$/, "", id)
    remember(id)
    next
}
/^Test Case .-\[[^ ]+ [^]]+\]. (passed|failed|skipped) \(/ {
    id = $0; sub(/^Test Case .-\[/, "", id); sub(/\]. (passed|failed|skipped) \(.*$/, "", id)
    rest = $0; sub(/^.*\]. /, "", rest)
    result = rest; sub(/ .*$/, "", result)
    seconds = rest; sub(/^[^(]*\(/, "", seconds); sub(/ seconds.*$/, "", seconds)
    remember(id)
    outcome[id] = result
    duration[id] = seconds
    next
}
/: error: -\[[^ ]+ [^]]+\] : / {
    id = $0; sub(/^.*: error: -\[/, "", id); sub(/\] : .*$/, "", id)
    text = $0; sub(/^.*: error: -\[[^]]+\] : /, "", text)
    if (!(id in message)) message[id] = text
    next
}
END {
    failures = 0; total = 0
    for (i = 1; i <= count; i++) {
        id = order[i]
        if (!(id in outcome)) {
            outcome[id] = "failed"; duration[id] = 0
            if (!(id in message)) message[id] = "the test started but never finished (it probably crashed)"
        }
        if (outcome[id] == "failed") failures++
        total += duration[id]
    }
    print "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
    print ""
    print "<testsuites>"
    printf "<testsuite name=\"TestResults\" errors=\"0\" tests=\"%d\" failures=\"%d\" time=\"%s\">\n", count, failures, total
    for (i = 1; i <= count; i++) {
        id = order[i]
        split(id, part, " ")
        printf "<testcase classname=\"%s\" name=\"%s\" time=\"%s\">\n", esc(part[1]), esc(part[2]), duration[id]
        # A skipped test gets no child element, exactly as in the report SwiftPM writes.
        if (outcome[id] == "failed") {
            printf "<failure message=\"%s\"></failure>\n", esc((id in message) ? message[id] : "failure")
        }
        print "</testcase>"
    }
    print "</testsuite>"
    print "</testsuites>"
}' "$LOG" >"$REPORT" || fail "cannot write $REPORT"

[ "$STATUS" -eq 0 ] || exit 1
exit 0
