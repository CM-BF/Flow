"""Supervise only the fixed operator PID; never signal its detached service groups."""
import json
from pathlib import Path
import subprocess
import sys
import time


def supervise(argv, work_seconds=118, exit_seconds=2):
    started = time.monotonic()
    child = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             start_new_session=True)
    timed_out = False
    stopped = False
    # No evidence writes precede or block this deadline. Every operator action,
    # including its initial reservation and final fsync, is inside this process.
    try:
        out, err = child.communicate(timeout=max(0, work_seconds - (time.monotonic() - started)))
        stopped = True
    except subprocess.TimeoutExpired as error:
        timed_out = True
        out, err = error.output or b'', error.stderr or b''
        child.kill()  # Only this unreaped child PID; not killpg and not a service PID.
        try:
            # Do not wait on inherited stdout descriptors held by other processes.
            child.wait(timeout=exit_seconds)
            stopped = True
        except subprocess.TimeoutExpired:
            pass
    finally:
        child.stdout.close()
        child.stderr.close()
    return {'operatorPid': child.pid, 'operatorExit': child.returncode,
            'deadlineExceeded': timed_out, 'operatorStopped': stopped,
            'outcome': 'unknown' if timed_out or child.returncode != 0 else 'operator-returned-zero',
            'elapsedMs': round((time.monotonic() - started) * 1000),
            'stdout': out.decode('utf8', errors='replace'),
            'stderr': err.decode('utf8', errors='replace'),
            'serviceSignals': 0}


if __name__ == '__main__':
    if sys.argv[1:] != ['--execute-center-once']:
        raise SystemExit('EXPLICIT_OPERATION_REQUIRED')
    operator = str(Path(__file__).resolve().with_name('operator.mjs'))
    result = supervise(['/opt/homebrew/opt/node@24/bin/node', operator, '--execute-center-once'])
    # This is a bounded metadata report after the PID stop decision, not a
    # precondition for termination. The caller retains its own raw tool receipt.
    print(json.dumps(result), flush=True)
    raise SystemExit(0 if result['outcome'] == 'operator-returned-zero' else 124 if result['deadlineExceeded'] else 1)
