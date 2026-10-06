#!/bin/sh
# Fixed outer observation only. The owned command and the Node entry own target deadlines/cleanup.
set -eu
umask 077
set -C
[ "$#" -eq 1 ] && [ "$1" = '--reviewed-native-pagesize-window' ]
[ "$(pwd -P)" = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities' ]
evidence='docs/evidence/wpf-mature-02/native-pagesize'
# Every file is exclusively reserved before the one Node host invocation.
: > "$evidence/outer-reservation.txt"
exec 3> "$evidence/outer-start.utc"
exec 4> "$evidence/outer-end.utc"
exec 5> "$evidence/safe-cli.stdout"
exec 6> "$evidence/outer-time.stderr"
exec 7> "$evidence/outer-exit.txt"
exec 8> "$evidence/outer-bytes.json"
exec 9> "$evidence/outer-final.utc"
/bin/date -u '+%Y-%m-%dT%H:%M:%SZ %s' >&3
set +e
/usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C TZ=UTC NODE_DISABLE_COMPILE_CACHE=1 /usr/bin/time -p /opt/homebrew/opt/node@24/bin/node --experimental-transform-types experiments/codex-app-server-conformance/native-pagesize/execute-reviewed.mjs --reviewed-native-pagesize-window >&5 2>&6
exit_code=$?
set -e
/bin/date -u '+%Y-%m-%dT%H:%M:%SZ %s' >&4
printf '%s\n' "$exit_code" >&7
exec 3>&- 4>&- 5>&- 6>&- 7>&-
# Count private host/time stderr once as capture and again as its disk copy; never print its text.
raw_bytes=$(/usr/bin/wc -c < "$evidence/outer-time.stderr")
receipt_bytes=$(/usr/bin/wc -c "$evidence/outer-start.utc" "$evidence/outer-end.utc" "$evidence/outer-exit.txt" | /usr/bin/awk 'END { print $1 }')
printf '{"rawCapturedBytes":%s,"rawDiskBytes":%s,"otherReceiptBytes":%s,"finalReceiptReserveBytes":64,"reserveBytes":8192}\n' "$raw_bytes" "$raw_bytes" "$receipt_bytes" >&8
exec 8>&-
self_bytes=$(/usr/bin/wc -c < "$evidence/outer-bytes.json")
[ "$((raw_bytes * 2 + receipt_bytes + self_bytes + 64))" -le 8192 ] || exit 1
# UTC seconds get +1 conservatively; time's rounded real alone cannot prove a 30s boundary.
/usr/bin/awk 'FILENAME ~ /outer-start.utc$/ { start=$2; next }
  FILENAME ~ /outer-end.utc$/ { end=$2; next }
  /^real [0-9]+([.][0-9]+)?$/ { real=$2; count++ }
  END { if (count != 1 || start <= 0 || end < start || end-start+1 > 30 || real > 30) exit 1 }' \
  "$evidence/outer-start.utc" "$evidence/outer-end.utc" "$evidence/outer-time.stderr" || exit 1
# This receipt is a tail sampling point, not a claim about the shell's actual exit.
/bin/date -u '+%Y-%m-%dT%H:%M:%SZ %s' >&9
exec 9>&-
final_receipt_bytes=$(/usr/bin/wc -c < "$evidence/outer-final.utc")
[ "$final_receipt_bytes" -le 64 ] || exit 1
read ignored_iso start_epoch < "$evidence/outer-start.utc"
# Observe again AFTER all automatic writes/closes/counting. No further evidence writes follow.
completion_epoch=$(/bin/date -u '+%s')
case "$start_epoch:$completion_epoch" in *[!0-9:]*|:*) exit 1;; esac
[ "$completion_epoch" -ge "$start_epoch" ] || exit 1
[ "$((completion_epoch - start_epoch + 1))" -le 30 ] || exit 1
# The external tool completion receipt must still confirm actual exit within the overall bound.
exit "$exit_code"
