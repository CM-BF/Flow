#!/bin/sh
# Fixed outer observation only. R06 and the Node entry own target deadlines/cleanup.
set -eu
umask 077
set -C
[ "$#" -eq 1 ] && [ "$1" = '--reviewed-node-rootliteral-window' ]
[ "$(pwd -P)" = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities' ]
evidence='docs/evidence/wpf-mature-02/node-rootliteral'
# Every file is exclusively reserved before the one Node host invocation.
: > "$evidence/outer-reservation.txt"
exec 3> "$evidence/outer-start.utc"
exec 4> "$evidence/outer-end.utc"
exec 5> "$evidence/safe-cli.stdout"
exec 6> "$evidence/outer-time.stderr"
exec 7> "$evidence/outer-exit.txt"
exec 8> "$evidence/outer-bytes.json"
/bin/date -u '+%Y-%m-%dT%H:%M:%SZ %s' >&3
set +e
/usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C TZ=UTC /usr/bin/time -p /opt/homebrew/opt/node@24/bin/node --experimental-transform-types experiments/codex-app-server-conformance/node-rootliteral/execute-reviewed.mjs --reviewed-node-rootliteral-window >&5 2>&6
exit_code=$?
set -e
/bin/date -u '+%Y-%m-%dT%H:%M:%SZ %s' >&4
printf '%s\n' "$exit_code" >&7
exec 3>&- 4>&- 5>&- 6>&- 7>&-
# Count private host/time stderr once as capture and again as its disk copy; never print its text.
raw_bytes=$(/usr/bin/wc -c < "$evidence/outer-time.stderr")
receipt_bytes=$(/usr/bin/wc -c "$evidence/outer-start.utc" "$evidence/outer-end.utc" "$evidence/outer-exit.txt" | /usr/bin/awk 'END { print $1 }')
printf '{"rawCapturedBytes":%s,"rawDiskBytes":%s,"otherReceiptBytes":%s,"reserveBytes":1024}\n' "$raw_bytes" "$raw_bytes" "$receipt_bytes" >&8
exec 8>&-
self_bytes=$(/usr/bin/wc -c < "$evidence/outer-bytes.json")
[ "$((raw_bytes * 2 + receipt_bytes + self_bytes))" -le 1024 ] || exit 1
# UTC seconds get +1 conservatively; time's rounded real alone cannot prove a 60s boundary.
/usr/bin/awk 'FILENAME ~ /outer-start.utc$/ { start=$2; next }
  FILENAME ~ /outer-end.utc$/ { end=$2; next }
  /^real [0-9]+([.][0-9]+)?$/ { real=$2; count++ }
  END { if (count != 1 || start <= 0 || end < start || end-start+1 > 60 || real > 60) exit 1 }' \
  "$evidence/outer-start.utc" "$evidence/outer-end.utc" "$evidence/outer-time.stderr" || exit 1
exit "$exit_code"
