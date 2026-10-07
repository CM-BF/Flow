"""No PG/imports/provider: exercise only the private owned-process supervisor."""
import importlib.util
import json
import errno
from pathlib import Path
import sys
import tempfile
import time
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('svc07_execution', HERE / 'execute-pg-once.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SupervisionTests(unittest.TestCase):
    def run_child(self, code, duration=1.5, limit=1024, **options):
        with tempfile.TemporaryDirectory(prefix='supervisor-check-', dir=HERE) as directory:
            output = Path(directory) / 'raw.log'
            start = time.monotonic()
            with output.open('xb') as log:
                result = module.supervise([sys.executable, '-c', code], dict(module.os.environ), log, start + duration, limit,
                                          on_spawn=lambda value: print('OWNED_SPAWN ' + json.dumps(value), flush=True), **options)
                print('OWNED_RESULT ' + json.dumps(result), flush=True)
            return result, output.read_bytes(), time.monotonic() - start

    def test_complete_combined_output_and_exit(self):
        result, raw, _ = self.run_child("import os; os.write(1,b'out'); os.write(2,b'err')")
        self.assertEqual(raw, b'outerr')
        self.assertEqual(result['exit'], 0)
        self.assertTrue(result['rawComplete'])
        self.assertTrue(result['groupAbsent'])

    def test_output_overflow_is_bounded_and_unknown(self):
        result, raw, _ = self.run_child("import os,time; os.write(1,b'x'*100000); time.sleep(5)", limit=128)
        self.assertEqual(len(raw), 128)
        self.assertEqual(result['reason'], 'OUTPUT_LIMIT')
        self.assertFalse(result['rawComplete'])
        self.assertTrue(result['groupAbsent'])

    def test_deadline_kills_a_child_ignoring_termination(self):
        result, _, elapsed = self.run_child("import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(20)", duration=0.15)
        self.assertEqual(result['reason'], 'DEADLINE')
        self.assertFalse(result['rawComplete'])
        self.assertTrue(result['groupAbsent'])
        self.assertLess(elapsed, 1.5)

    def test_leader_exit_with_descendant_is_not_success(self):
        result, _, elapsed = self.run_child("import subprocess,sys; subprocess.Popen([sys.executable,'-c','import time; time.sleep(20)']); print('leader exited')", duration=0.15)
        self.assertEqual(result['exit'], 0)
        self.assertEqual(result['reason'], 'DEADLINE')
        self.assertFalse(result['rawComplete'])
        self.assertLess(elapsed, 1.5)

    def test_permission_unknown_does_not_signal_or_replace_output_limit(self):
        def denied(_pid, _signal):
            raise PermissionError(errno.EPERM, 'controlled observation denial')
        signals = []
        result, raw, _ = self.run_child("print('known finite output')", limit=2,
                                       observe=lambda pid: module.observe_group(pid, denied),
                                       send=lambda *args: signals.append(args))
        self.assertEqual(len(raw), 2)
        self.assertEqual(result['reason'], 'OUTPUT_LIMIT')
        self.assertEqual(result['groupState'], {'state': 'unknown', 'errno': errno.EPERM})
        self.assertFalse(result['groupAbsent'])
        self.assertEqual(signals, [])

    def test_signal_permission_failure_is_explicit_unknown(self):
        def denied(_pid, _signal):
            raise PermissionError(errno.EPERM, 'controlled signal denial')
        self.assertEqual(module.signal_group(123, module.signal.SIGTERM, denied),
                         {'state': 'unknown', 'errno': errno.EPERM, 'signal': module.signal.SIGTERM})


if __name__ == '__main__':
    unittest.main(verbosity=2)
