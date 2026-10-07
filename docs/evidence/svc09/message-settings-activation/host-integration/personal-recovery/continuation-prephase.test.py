"""Actual run.main -> pinned execute; only private paths, disk and phase launch are replaced."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SCRATCH = Path(os.environ['TMPDIR']).resolve()
spec = importlib.util.spec_from_file_location('prephase_actual_caller', HERE / 'run.py')
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)
DISPATCH = json.loads((HERE / 'continuation-r2-dispatch.json').read_bytes())
INPUT = json.loads(caller.pin(DISPATCH['input']))
assert INPUT['ready'] is False
REAL_LOAD = caller.load
REAL_PIN = caller.pin


class Boundary(unittest.TestCase):
    def setUp(self):
        self.root = SCRATCH / self._testMethodName
        self.root.mkdir(mode=0o700)
        self.run = self.root / 'run'
        self.phase_launches = []
        self.pins = []
        self.disk_calls = []
        self.value = copy.deepcopy(INPUT)
        self.value['ready'] = True
        self.value['migration']['budget']['freshBytes'] = 17452105728
        self.disk_available = 18007851008
        self.execute = None

    def tearDown(self):
        # Only exact files created by this fixture, never recursively remove unknowns.
        if self.run.is_symlink():
            self.run.unlink()
        elif self.run.exists():
            for file in self.run.iterdir():
                assert file.is_file() and not file.is_symlink()
                file.unlink()
            self.run.rmdir()
        self.root.rmdir()

    def load_actual(self, path, name):
        self.assertEqual(path, DISPATCH['continuation']['path'])
        module = REAL_LOAD(path, name)
        self.execute = module.execute
        original_path = module.Path
        original_spec = module.importlib.util.spec_from_file_location
        plan_path = Path(DISPATCH['input']['path'])
        def owned_path(value):
            value = original_path(value)
            if str(value) == self.value['runDirectory']:
                return self.run
            # PLAN and inherited raw accounting are public, pinned evidence inputs.
            self.assertTrue(value in [plan_path, module.BASE / 'personal-actual-r2', original_path(caller.NODE)])
            return value
        def statvfs(value):
            self.assertEqual(str(value), self.value['migration']['installationDirectory'])
            self.disk_calls.append(str(value))
            return SimpleNamespace(f_bavail=self.disk_available, f_frsize=1)
        module.Path = owned_path
        module.os = SimpleNamespace(**{key: getattr(os, key) for key in dir(os)})
        module.os.statvfs = statvfs
        # Preserve the real loader/OPS14 Launch and Policy validation. Only the final
        # supervise call is replaced, so no phase Node or personal service can start.
        def spec_with_supervise(path_name, filename):
            self.assertEqual(str(filename), DISPATCH['supervisor']['path'])
            result = original_spec(path_name, filename)
            original_exec = result.loader.exec_module
            def exec_module(ops):
                original_exec(ops)
                ops.supervise = self.first_phase_boundary
            result.loader.exec_module = exec_module
            return result
        module.importlib = SimpleNamespace(util=SimpleNamespace(spec_from_file_location=spec_with_supervise, module_from_spec=importlib.util.module_from_spec))
        return module

    def first_phase_boundary(self, launch, policy):
        phase = launch.argv[launch.argv.index('--phase') + 1]
        self.phase_launches.append(phase)
        self.assertEqual(phase, 'fresh')
        self.assertEqual(launch.ownership.value, 'childPidOnly')
        reservation = json.loads((self.run / 'reservation.json').read_bytes())
        deadline = json.loads((self.run / 'maintenance-deadline.json').read_bytes())
        invocation = json.loads((self.run / 'fresh-invocation.json').read_bytes())
        self.assertEqual(reservation['window'], caller.WINDOW)
        self.assertEqual(reservation['planSha256'], DISPATCH['input']['sha256'])
        self.assertEqual(deadline['seconds'], 900)
        self.assertEqual(invocation['argv'], list(launch.argv))
        self.assertGreater(invocation['remainingWorkSeconds'], 0)
        self.assertTrue(all(file.stat().st_mode & 0o777 == 0o600 for file in self.run.iterdir()))
        raise StopBeforePersonalPhase('EXPECTED_TEST_STOP_BEFORE_PHASE_CHILD')

    def checked_pin(self, binding):
        value = REAL_PIN(binding)
        self.pins.append(binding['path'])
        return json.dumps(self.value).encode() if binding['path'] == DISPATCH['input']['path'] else value

    def invoke(self):
        with patch.object(caller, 'pin', self.checked_pin), patch.object(caller, 'load', self.load_actual):
            return caller.main(['--execute-remaining-r2-once', str(int(time.time() * 1000) + 30000), str(time.monotonic() + 30)])

    def test_actual_main_real_execute_reaches_first_phase_after_persistence(self):
        with self.assertRaises(StopBeforePersonalPhase):
            self.invoke()
        self.assertEqual(self.phase_launches, ['fresh'])
        self.assertEqual(len(self.disk_calls), 2)
        self.assertEqual(json.loads((self.run / 'stop.json').read_bytes())['completed'], [])
        inherited = json.loads(REAL_PIN(DISPATCH['inheritedDispatch']))
        effective = {p['path'] for p in inherited['bindings']} | {p['path'] for p in DISPATCH['bindings']}
        self.assertTrue(effective.issubset(self.pins))

    def test_original_window_is_rejected_by_real_execute_before_mkdir(self):
        with patch.object(caller, 'WINDOW', 'svc06-personal-held23-e15-continuation-once'):
            with self.assertRaises(AssertionError):
                self.invoke()
        self.assertEqual(self.phase_launches, [])
        self.assertEqual(self.disk_calls, [])
        self.assertFalse(self.run.exists())

    def test_existing_namespace_rejected_before_overwrite(self):
        self.run.mkdir(mode=0o700)
        marker = self.run / 'original'
        marker.write_bytes(b'unchanged')
        with self.assertRaises(AssertionError):
            self.invoke()
        self.assertEqual(marker.read_bytes(), b'unchanged')
        self.assertEqual(self.phase_launches, [])

    def test_symlink_namespace_rejected_without_following(self):
        self.run.symlink_to(self.root / 'absent-target')
        with self.assertRaises(AssertionError):
            self.invoke()
        self.assertFalse((self.root / 'absent-target').exists())
        self.assertEqual(self.phase_launches, [])

    def test_fresh_capacity_rejected_before_mkdir(self):
        self.disk_available = 0
        with self.assertRaises(AssertionError):
            self.invoke()
        self.assertFalse(self.run.exists())
        self.assertEqual(self.phase_launches, [])

    def test_old_entry_and_old_namespace_cannot_replay(self):
        with self.assertRaises(AssertionError):
            caller.main(['--run-remaining-once'])
        self.value['runDirectory'] = INPUT['predecessor']['runDirectory']
        with self.assertRaises(AssertionError):
            self.invoke()
        self.assertIsNone(self.execute)
        self.assertEqual(self.phase_launches, [])


class StopBeforePersonalPhase(Exception):
    pass


if __name__ == '__main__':
    unittest.main(verbosity=2)
