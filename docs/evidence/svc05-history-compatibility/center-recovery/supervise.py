"""Supervise only the fixed operator PID; never signal its detached service groups."""
import importlib.util
import json
import os
from pathlib import Path
import sys


_module_path = Path(__file__).resolve().parents[4] / 'tools/owned-process-supervision/supervise.py'
_spec = importlib.util.spec_from_file_location('flow_owned_process_supervision', _module_path)
_supervision = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = _supervision
_spec.loader.exec_module(_supervision)


def supervise(argv, work_seconds=118, exit_seconds=2):
    report = _supervision.supervise(
        _supervision.Launch(tuple(argv), os.getcwd(), dict(os.environ),
                            _supervision.Ownership.CHILD_PID_ONLY),
        _supervision.Policy(work_seconds, 0, exit_seconds, 65536))
    failures = ([report.first_failure] if report.first_failure else []) + report.secondary_failures
    timed_out = any(failure['code'] == 'DEADLINE_EXCEEDED' for failure in failures)
    stopped = report.pid is not None and report.owned_state == 'absent'
    returned_zero = (stopped and report.exit_code == 0 and not failures
                     and all(report.eof.values()))
    return {'operatorPid': report.pid, 'operatorExit': report.exit_code,
            'deadlineExceeded': timed_out, 'operatorStopped': stopped,
            'outcome': 'operator-returned-zero' if returned_zero else 'unknown',
            'elapsedMs': report.elapsed_ms,
            'stdout': report.stdout.decode('utf8', errors='replace'),
            'stderr': report.stderr.decode('utf8', errors='replace'),
            'serviceSignals': 0,
            'supervision': {'ownership': report.ownership, 'capture': report.capture,
                            'firstFailure': report.first_failure,
                            'secondaryFailures': report.secondary_failures,
                            'ownedState': report.owned_state, 'eof': report.eof,
                            'observedBytes': report.observed_bytes,
                            'retainedBytes': report.retained_bytes,
                            'signals': report.signals}}


if __name__ == '__main__':
    if sys.argv[1:] != ['--execute-center-once']:
        raise SystemExit('EXPLICIT_OPERATION_REQUIRED')
    operator = str(Path(__file__).resolve().with_name('operator.mjs'))
    result = supervise(['/opt/homebrew/opt/node@24/bin/node', operator, '--execute-center-once'])
    # This is a bounded metadata report after the PID stop decision, not a
    # precondition for termination. The caller retains its own raw tool receipt.
    print(json.dumps(result), flush=True)
    raise SystemExit(0 if result['outcome'] == 'operator-returned-zero' else 124 if result['deadlineExceeded'] else 1)
