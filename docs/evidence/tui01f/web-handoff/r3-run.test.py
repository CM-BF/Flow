"""Actual R3 dispatch through fixed input checks and OPS14 validation; stop before a journey child."""
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
spec = importlib.util.spec_from_file_location('tui_r3', Path(__file__).with_name('r3-run.py'))
entry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(entry)
caller, run = entry.caller, entry.R3


class BoundaryReached(Exception):
    pass


class R3Boundary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixed, cls.digest, cls.count = caller.verify_inputs(run)

    def permit(self):
        now = datetime.now(timezone.utc)
        return dict(ready=True, windowId=run.window, sourceDigest=self.fixed['sourceDigest'],
            inputDigest=self.digest, callerDigest=caller.sha(Path(caller.__file__).read_bytes()),
            providerCalls=0, personalOperations=0, logicalId=run.logical_id,
            startBefore=(now + timedelta(seconds=20)).isoformat(), freshObservedAt=now.isoformat(),
            pgAvailable=42, preflightPoolClosed=True, minimumFreshFreeBytes=2**30+128*1024**2, actualHolder=None)

    def populate(self, root):
        (root / run.input_name).write_bytes(Path(__file__).with_name(run.input_name).read_bytes())
        (root / run.permit_name).write_text(json.dumps(self.permit()))

    def test_actual_r3_entry_reaches_only_exact_supervise_boundary(self):
        self.assertEqual(self.count, 741)
        self.assertEqual(len(self.fixed['own']), 7)
        with tempfile.TemporaryDirectory(prefix='tui-r3-entry-', dir=os.environ['TMPDIR']) as tmp:
            root = Path(tmp); self.populate(root)
            ops = caller.load_ops(self.fixed['supervisor'])
            def stop(launch, policy):
                ops._validate(launch, policy)
                self.assertEqual(launch.argv, (self.fixed['node']['path'], '--import', 'tsx',
                    'experiments/tui-web-control-handoff/journey.ts', '--run', str(root / run.permit_name)))
                self.assertEqual((policy.work_seconds, policy.term_grace_seconds, policy.kill_grace_seconds, policy.output_bytes), (150, .5, 2, 65536))
                record = json.loads((root / run.outer_name / 'reservation.json').read_text())
                self.assertEqual(record['window'], run.window)
                self.assertEqual(record['sourceDigest'], self.fixed['sourceDigest'])
                self.assertEqual(record['inheritedPins'], 741)
                self.assertEqual((root / run.outer_name).stat().st_mode & 0o777, 0o700)
                self.assertEqual((root / run.outer_name / 'reservation.json').stat().st_mode & 0o777, 0o600)
                raise BoundaryReached()
            with patch.object(caller, 'HERE', root), patch.object(caller, 'load_ops', return_value=ops), \
                 patch.object(ops, 'supervise', side_effect=stop), \
                 patch.dict(os.environ, {'FLOW_TEST_DATABASE_URL': 'postgresql://127.0.0.1/postgres'}):
                with self.assertRaises(BoundaryReached): entry.main(['--run-r3-once'])
                with self.assertRaises(FileExistsError): entry.main(['--run-r3-once'])

    def test_default_r2_and_old_authority_are_not_retargeted(self):
        self.assertEqual(caller.R2, caller.RunSpec('--run-r2-once', caller.WINDOW, caller.INPUT,
            caller.PERMIT, caller.OUTER, 'TUI01F04-REAL-HANDOFF-R2-ONCE'))
        with self.assertRaisesRegex(AssertionError, 'EXACT_ARGUMENT'): caller.main(['--run-r3-once'])
        with self.assertRaisesRegex(AssertionError, 'EXACT_ARGUMENT'): entry.main(['--run-r2-once'])
        with self.assertRaisesRegex(AssertionError, 'TRUSTED_RUN_SPEC'): caller.main([], dict(window=run.window))
        permit = {**self.permit(), 'logicalId': caller.R2.logical_id}
        with self.assertRaisesRegex(AssertionError, 'LOGICAL_ID'):
            caller.validate_permit(permit, self.fixed, self.digest, datetime.now(timezone.utc), 2**40, run)

    def test_pending_and_wrong_source_refuse_without_launch(self):
        for change, reason in [({'ready': False}, 'UNSELECTED'), ({'sourceDigest': '0'*64}, 'SOURCE_BINDING'),
                               ({'callerDigest': '0'*64}, 'CALLER_BINDING'), ({'pgAvailable': 41}, 'PG_CAPACITY'),
                               ({'actualHolder': 'other'}, 'HOLDER')]:
            with self.subTest(change=change), self.assertRaisesRegex(AssertionError, reason):
                caller.validate_permit({**self.permit(), **change}, self.fixed, self.digest, datetime.now(timezone.utc), 2**40, run)
        pending=json.loads(Path(__file__).with_name('r3-permit.pending.json').read_text())
        self.assertFalse(pending['ready'])
        self.assertEqual(pending['inputDigest'], self.digest)
        self.assertEqual(pending['sourceDigest'], self.fixed['sourceDigest'])

    def test_real_entry_rejects_consumed_and_symlink_namespaces(self):
        for kind in ('window', 'capture', 'outer-symlink', 'permit-symlink'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory(prefix='tui-r3-refuse-', dir=os.environ['TMPDIR']) as tmp:
                root=Path(tmp); self.populate(root)
                if kind=='window':
                    (root/'windows').mkdir(); (root/'windows'/(run.window+'.json')).write_text('{}')
                elif kind=='capture':
                    (root/'captures').mkdir(); (root/'captures'/run.window).mkdir()
                elif kind=='outer-symlink': (root/run.outer_name).symlink_to(root, target_is_directory=True)
                else:
                    (root/run.permit_name).rename(root/'permit-target'); (root/run.permit_name).symlink_to(root/'permit-target')
                ops=caller.load_ops(self.fixed['supervisor'])
                with patch.object(caller,'HERE',root), patch.object(caller,'load_ops',return_value=ops), \
                     patch.object(ops,'supervise',side_effect=AssertionError('MUST_NOT_LAUNCH')) as launch, \
                     patch.dict(os.environ,{'FLOW_TEST_DATABASE_URL':'postgresql://127.0.0.1/postgres'}):
                    with self.assertRaises((AssertionError,FileExistsError)):entry.main(['--run-r3-once'])
                    launch.assert_not_called()


if __name__ == '__main__': unittest.main()
