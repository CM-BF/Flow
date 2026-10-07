"""Real fixed caller up to OPS14's launch boundary; no journey child is started."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.dont_write_bytecode = True
SOURCE = Path(__file__).with_name('r2-run.py')
spec = importlib.util.spec_from_file_location('tui_r2_caller', SOURCE)
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)


class BoundaryReached(Exception):
    pass


class FixedCaller(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixed, cls.digest, cls.count = caller.verify_inputs()

    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.permit = dict(ready=True, windowId=caller.WINDOW, sourceDigest=self.fixed['sourceDigest'],
            inputDigest=self.digest, callerDigest=caller.sha(SOURCE.read_bytes()), providerCalls=0,
            personalOperations=0, logicalId='TUI01F04-REAL-HANDOFF-R2-ONCE',
            startBefore=(self.now + timedelta(seconds=20)).isoformat(), freshObservedAt=self.now.isoformat(),
            pgAvailable=42, preflightPoolClosed=True, minimumFreshFreeBytes=1024**3 + 128*1024**2, actualHolder=None)

    def test_actual_741_inputs_and_original_identity(self):
        self.assertEqual(self.count, 741)
        self.assertEqual(self.fixed['sourceDigest'], 'b157e0692813f2e4f092e9873485da36dff2e79031f34f8d7f41c2275d469eb9')

    def test_admission_rejects_missing_or_stale_authority(self):
        for change, reason in [(dict(ready=False), 'UNSELECTED'), (dict(startBefore=self.now.isoformat()), 'EXPIRED'),
                       (dict(sourceDigest='0'*64), 'SOURCE_BINDING'), (dict(callerDigest='0'*64), 'CALLER_BINDING'),
                       (dict(pgAvailable=41), 'PG_CAPACITY'), (dict(preflightPoolClosed=False), 'PG_CAPACITY'),
                       (dict(providerCalls=1), 'SCOPE'), (dict(actualHolder='other'), 'HOLDER'),
                       (dict(minimumFreshFreeBytes=1), 'FRESH_SPACE')]:
            with self.subTest(change=change), self.assertRaisesRegex(AssertionError, reason):
                caller.validate_permit({**self.permit, **change}, self.fixed, self.digest, self.now, 2**40)
        with self.assertRaises(AssertionError):
            caller.validate_permit(self.permit, self.fixed, self.digest, self.now, 1)

    def test_real_entry_reserves_and_constructs_validated_exact_launch(self):
        with tempfile.TemporaryDirectory(prefix='tui-r2-entry-', dir=os.environ['TMPDIR']) as tmp:
            root = Path(tmp)
            (root / caller.INPUT).write_bytes(SOURCE.with_name(caller.INPUT).read_bytes())
            (root / caller.PERMIT).write_text(json.dumps(self.permit))
            ops = caller.load_ops(self.fixed['supervisor'])
            def stop_at_launch(launch, policy):
                ops._validate(launch, policy)
                self.assertEqual(launch.argv, (self.fixed['node']['path'], '--import', 'tsx',
                    'experiments/tui-web-control-handoff/journey.ts', '--run', str(root / caller.PERMIT)))
                self.assertEqual(launch.cwd, str(caller.ROOT))
                self.assertEqual((policy.work_seconds, policy.term_grace_seconds, policy.kill_grace_seconds), (150, .5, 2))
                record = json.loads((root / caller.OUTER / 'reservation.json').read_text())
                self.assertEqual(record['inheritedPins'], 741)
                self.assertEqual(record['outcome'], 'UNKNOWN_KEEP')
                self.assertEqual((root / caller.OUTER).stat().st_mode & 0o777, 0o700)
                self.assertEqual((root / caller.OUTER / 'reservation.json').stat().st_mode & 0o777, 0o600)
                raise BoundaryReached()
            with patch.object(caller, 'HERE', root), patch.object(caller, 'load_ops', return_value=ops), \
                 patch.object(ops, 'supervise', side_effect=stop_at_launch), \
                 patch.dict(os.environ, {'FLOW_TEST_DATABASE_URL': 'postgresql://127.0.0.1/postgres'}):
                with self.assertRaises(BoundaryReached):
                    caller.main(['--run-r2-once'])
                with self.assertRaises(FileExistsError):
                    caller.main(['--run-r2-once'])

    def test_consumed_and_symlink_namespaces_refuse_before_launch(self):
        for kind in ['window', 'capture', 'outer-symlink', 'permit-symlink']:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory(prefix='tui-r2-reject-', dir=os.environ['TMPDIR']) as tmp:
                root = Path(tmp)
                (root / caller.INPUT).write_bytes(SOURCE.with_name(caller.INPUT).read_bytes())
                target = root / caller.PERMIT
                target.write_text(json.dumps(self.permit))
                if kind == 'window':
                    (root / 'windows').mkdir(); (root / 'windows' / (caller.WINDOW + '.json')).write_text('{}')
                elif kind == 'capture':
                    (root / 'captures').mkdir(); (root / 'captures' / caller.WINDOW).mkdir()
                elif kind == 'outer-symlink':
                    (root / caller.OUTER).symlink_to(root, target_is_directory=True)
                else:
                    target.rename(root / 'permit-value.json'); target.symlink_to(root / 'permit-value.json')
                ops = caller.load_ops(self.fixed['supervisor'])
                with patch.object(caller, 'HERE', root), patch.object(caller, 'load_ops', return_value=ops), \
                     patch.object(ops, 'supervise', side_effect=AssertionError('MUST_NOT_LAUNCH')) as launch, \
                     patch.dict(os.environ, {'FLOW_TEST_DATABASE_URL': 'postgresql://127.0.0.1/postgres'}):
                    with self.assertRaises((AssertionError, FileExistsError)):
                        caller.main(['--run-r2-once'])
                    launch.assert_not_called()

    def test_unknown_cli_and_record_overflow_refuse(self):
        with self.assertRaises(AssertionError):
            caller.main(['--run'])
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as tmp:
            p = Path(tmp) / 'large.json'
            with self.assertRaises(AssertionError):
                caller.save(p, {'data': 'x' * (512 * 1024)})
            self.assertFalse(p.exists())


if __name__ == '__main__':
    unittest.main()
