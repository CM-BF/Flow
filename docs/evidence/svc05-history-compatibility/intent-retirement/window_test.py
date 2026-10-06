import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import tempfile
import json
import os

SPEC = importlib.util.spec_from_file_location('window', Path(__file__).with_name('window.py'))
window = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(window)

class DrainDeadline(unittest.TestCase):
    def test_uses_larger_elapsed_clock_without_reset(self):
        data = {'limitSeconds': 900, 'wallStart': 100, 'monotonicStart': 50}
        self.assertEqual(window.remaining_budget(data, 110, 70), 880)
        self.assertEqual(window.remaining_budget(data, 999, 70), 1)
        self.assertLess(window.remaining_budget(data, 1001, 70), 0)
        for wall, mono in [(99, 70), (110, 49)]:
            with self.assertRaisesRegex(RuntimeError, 'CLOCK_CHANGED'): window.remaining_budget(data, wall, mono)
        with self.assertRaisesRegex(RuntimeError, 'LIMIT'): window.remaining_budget({**data, 'limitSeconds': 901}, 110, 70)

    def test_expired_marker_never_spawns_and_remaining_caps_existing_supervisor(self):
        with tempfile.TemporaryDirectory(prefix='flow-drain-budget-') as root:
            path = Path(root) / 'marker.json'
            path.write_text(json.dumps({'windowId': 'synthetic', 'limitSeconds': 900, 'wallStart': 100, 'monotonicStart': 50}))
            path.chmod(0o600)
            with patch.object(window.MODULE, 'supervise', return_value={'synthetic': True}) as run:
                with patch.object(window.time, 'time', return_value=999), patch.object(window.time, 'monotonic', return_value=60):
                    self.assertEqual(window.run_step(['must-not-run'], path, 'synthetic')['outcome'], 'NOT_RUN')
                    run.assert_not_called()
                with patch.object(window.time, 'time', return_value=990), patch.object(window.time, 'monotonic', return_value=60):
                    result = window.run_step(['synthetic'], path, 'synthetic')
                    run.assert_called_once_with(['synthetic'], work_seconds=8, exit_seconds=2)
                    self.assertEqual(result['totalDrainElapsedSeconds'], 890)
                with self.assertRaisesRegex(RuntimeError, 'IDENTITY'): window.run_step([], path, 'other-window')
        self.assertFalse(Path(root).exists())
        print(json.dumps({'syntheticTemporaryRoot': root, 'removed': True, 'serviceProcesses': 0}))

if __name__ == '__main__': unittest.main(verbosity=2)
