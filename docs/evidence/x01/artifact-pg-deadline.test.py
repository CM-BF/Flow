"""One pure-clock regression; no PG, processes, temporary files, or actual persistence."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('artifact_pg_subject', Path(__file__).with_name('artifact-pg-once.py'))
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)

class FinalDeadline(unittest.TestCase):
    def test_save_crossing_deadline_is_unknown_without_rewriting_snapshot(self):
        for initial, after_save, expected, saves in [(175.0, 180.1, 'UNKNOWN', 1), (179.0, 179.0, 'UNKNOWN', 0), (175.0, 176.0, 'PASSED', 1)]:
            clock = [initial]
            snapshots = []
            report = {'state': 'PASSED', 'unknown': False, 'retained': [], 'rawChargeBeforeReceipt': 0, 'limits': {'rawBytes': 1048576}}
            def save(path, data):
                snapshots.append(json.loads(data))
                clock[0] = after_save
            with patch.object(subject.time, 'monotonic', side_effect=lambda: clock[0]), patch.object(subject, 'save', side_effect=save):
                delivery, code = subject.persist_final_receipt(report, Path('/not-written/result.json'), 0.0, 180.0)
            self.assertEqual(delivery['state'], expected)
            self.assertEqual(code, 0 if expected == 'PASSED' else 1)
            self.assertEqual(len(snapshots), saves)
            self.assertEqual(delivery['elapsedAfterPersistence'], after_save)
            if snapshots:
                self.assertEqual(snapshots[0]['recordPhase'], 'before-final-persistence')
                self.assertEqual(snapshots[0]['elapsedBeforePersistence'], initial)
                self.assertEqual(snapshots[0]['state'], 'PASSED')
            if after_save >= 180:
                self.assertFalse(delivery['withinTotalDeadline'])
                self.assertEqual(delivery['resultPersistence'], 'CONFIRMED')

if __name__ == '__main__':
    unittest.main()
