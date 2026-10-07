"""Pure injected group-state regressions; never Popen, kill or PG."""
import datetime
import errno
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import sys
import time
from unittest.mock import patch


def main():
    start = time.monotonic()
    script = Path(__file__).with_name('execute-pg-once.py')
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('c02_owned_check', script)
    module = importlib.util.module_from_spec(spec)
    results = []
    class Child:
        pid = 987654321
        def wait(self, timeout): return 0
    with patch('subprocess.Popen', side_effect=AssertionError('Popen forbidden')) as spawn, patch('os.killpg', side_effect=AssertionError('Real signal forbidden')):
        spec.loader.exec_module(module)
        with patch.object(module, 'group_state', side_effect=['unknown', 'absent']) as observe:
            report = module.stop_group(Child())
            assert report == {'state': 'unknown', 'signals': [], 'observations': ['unknown']}
            assert observe.call_count == 1
            results.append('unknown-is-not-upgraded-by-later-absence')
        with patch.object(module, 'group_state', side_effect=['present', 'absent']) as observe, patch.object(module.os, 'killpg') as send:
            report = module.stop_group(Child())
            assert report == {'state': 'absent', 'signals': [int(signal.SIGTERM)], 'observations': ['present', 'absent']}
            assert observe.call_count == 2; send.assert_called_once_with(Child.pid, signal.SIGTERM)
            results.append('present-to-absent-closes-without-kill')
        with patch.object(module, 'group_state', side_effect=['present', 'absent']) as observe, patch.object(module.os, 'killpg', side_effect=PermissionError(errno.EPERM, 'injected')) as send:
            report = module.stop_group(Child())
            assert report == {'state': 'unknown', 'signals': [], 'observations': ['present'], 'signalErrno': errno.EPERM}
            assert observe.call_count == 1; assert send.call_count == 1
            results.append('signal-permission-failure-remains-unknown')
        with patch.object(module.os, 'killpg', side_effect=PermissionError(errno.EPERM, 'injected')) as send:
            report = module.stop_group(Child())
            assert report == {'state': 'unknown', 'signals': [], 'observations': ['unknown']}
            send.assert_called_once_with(Child.pid, 0)
            results.append('observation-permission-failure-remains-unknown')
        assert spawn.call_count == 0
    result = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'elapsedSeconds': time.monotonic() - start,
              'selected': 4, 'passed': 4, 'cases': results, 'subprocessCalls': 0, 'realSignals': 0, 'pg': 0,
              'sourceSha256': hashlib.sha256(script.read_bytes()).hexdigest()}
    with Path(__file__).with_name('stop-group-check-result.json').open('x') as file:
        json.dump(result, file, indent=2); file.write('\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
