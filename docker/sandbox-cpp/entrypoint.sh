#!/bin/sh
set -e

# Read user code from stdin
USER_CODE=$(cat)

# Insert user code into harness
HARNESS=$(cat /sandbox/harness.cpp)
FULL_CODE="${HARNESS//\/\/USER_CODE_PLACEHOLDER\/\//$USER_CODE}"

# Write to temp file
echo "$FULL_CODE" > /tmp/player.cpp

# Compile with 10s timeout
timeout 10 g++ -std=c++17 -O0 -o /tmp/player /tmp/player.cpp -I/usr/include/nlohmann 2>/tmp/compile_err.txt
if [ $? -ne 0 ]; then
    echo '{"ok":false,"error":"Compile error: '"$(cat /tmp/compile_err.txt | head -3)"'"}'
    exit 0
fi

# Run with 3s timeout
timeout 3 /tmp/player 2>/dev/null | head -1 | python3 -c "
import sys, json
line = sys.stdin.read().strip()
try:
    calls = json.loads(line)
    print(json.dumps({'ok': True, 'calls': calls}))
except:
    print(json.dumps({'ok': True, 'calls': []}))
"
