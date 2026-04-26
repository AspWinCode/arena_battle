#!/bin/sh
set -e

USER_CODE=$(cat)
HARNESS=$(cat /sandbox/RobotHarness.java)
FULL_CODE="${HARNESS//\/\/USER_CODE_PLACEHOLDER\/\//$USER_CODE}"

echo "$FULL_CODE" > /tmp/RobotHarness.java

timeout 15 javac /tmp/RobotHarness.java -d /tmp 2>/tmp/compile_err.txt
if [ $? -ne 0 ]; then
    echo '{"ok":false,"error":"Compile error"}'
    exit 0
fi

timeout 3 java -cp /tmp -Xmx32m RobotHarness 2>/dev/null
