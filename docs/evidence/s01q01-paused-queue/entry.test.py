import importlib.util
from pathlib import Path
import unittest
import tempfile
import time
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('queue_entry', Path(__file__).with_name('entry.py'))
entry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(entry)


class CandidateAdmission(unittest.TestCase):
    def permit(self):
        return {'state': 'OPEN', 'reviewed': True, 'totalSeconds': 140, 'testNames': list(entry.TEST_NAMES),
                'expiresEpoch': 1000, 'head': 'a' * 40, 'window': 'b' * 32, 'inputSha256': 'c' * 64, 'requiredFreeBytes': 1}

    def test_closed_permit_prevents_namespace_and_input_access(self):
        with patch.object(entry, 'read_json', return_value={'state': 'CLOSED'}), patch.object(Path, 'mkdir') as mkdir, patch.object(entry, 'verify_inputs') as verify:
            with self.assertRaisesRegex(ValueError, 'PG_NOT_OPEN'): entry.run(Path('/candidate'))
            mkdir.assert_not_called(); verify.assert_not_called()

    def test_old_120_second_permit_is_rejected(self):
        permit = self.permit(); permit['totalSeconds'] = 120
        with self.assertRaisesRegex(ValueError, 'PERMIT_SCOPE_MISMATCH'): entry.validate_permit(permit, 0)

    def test_preflight_does_not_reset_expiry(self):
        with self.assertRaisesRegex(ValueError, 'PERMIT_TIME_INSUFFICIENT'): entry.validate_permit(self.permit(), 861)
        entry.validate_permit(self.permit(), 860)

    def test_wrong_selection_cannot_be_a_success(self):
        result = {'success': True, 'testResults': [{'assertionResults': [{'title': name, 'status': 'passed'} for name in entry.TEST_NAMES]}]}
        self.assertTrue(entry.selected_passed(result))
        result['testResults'][0]['assertionResults'].append({'title': 'unrelated', 'status': 'passed'})
        self.assertFalse(entry.selected_passed(result))

    def test_failed_assertion_stays_failed(self):
        result = {'success': False, 'testResults': [{'assertionResults': [{'title': name, 'status': 'passed'} for name in entry.TEST_NAMES]}]}
        self.assertFalse(entry.selected_passed(result))

    def test_incomplete_capture_or_signal_is_unknown(self):
        report = {'exit_code': 1, 'owned_state': 'absent', 'capture': 'merged', 'eof': {'stdout': True}, 'observed_bytes': 1, 'retained_bytes': 1, 'first_failure': {'code': 'CHILD_EXIT_NONZERO'}, 'secondary_failures': [], 'signals': []}
        self.assertTrue(entry.process_closed(report))
        report['retained_bytes'] = 0
        self.assertFalse(entry.process_closed(report))
        report['retained_bytes'] = 1; report['signals'] = [{'outcome': 'unknown'}]
        self.assertFalse(entry.process_closed(report))

    def test_storage_limits_precede_cleanup_and_preserve_contents(self):
        with tempfile.TemporaryDirectory() as value:
            root = Path(value).resolve(); (root / 'data').write_bytes(b'1234')
            with self.assertRaisesRegex(ValueError, 'STORAGE_LIMIT'): entry.sample_tree(root, time.monotonic() + 1, 3)
            self.assertEqual((root / 'data').read_bytes(), b'1234')
            with self.assertRaisesRegex(ValueError, 'STORAGE_LIMIT'): entry.sample_tree(root, time.monotonic() + 1, 8, 0)
            with self.assertRaisesRegex(ValueError, 'STORAGE_DEADLINE'): entry.sample_tree(root, 0, 8)

    def test_storage_unknown_is_not_empty(self):
        with tempfile.TemporaryDirectory() as value:
            root = Path(value).resolve()
            with patch.object(entry.os, 'walk', side_effect=PermissionError('denied')):
                with self.assertRaises(PermissionError): entry.sample_tree(root, time.monotonic() + 1, 8)
            (root / 'link').symlink_to('/nonexistent')
            with self.assertRaisesRegex(ValueError, 'NAMESPACE_UNKNOWN'): entry.sample_tree(root, time.monotonic() + 1, 8)

    def test_cleanup_requires_same_sample_identity_and_deadline(self):
        with tempfile.TemporaryDirectory() as value:
            root = Path(value).resolve() / 'owned'; root.mkdir(); (root / 'data').write_bytes(b'1234')
            sample = entry.sample_tree(root, time.monotonic() + 1, 8)
            with self.assertRaisesRegex(ValueError, 'CLEANUP_DEADLINE'): entry.remove_sampled(root, sample, 0)
            self.assertTrue((root / 'data').exists())
            self.assertEqual(entry.remove_sampled(root, sample, time.monotonic() + 1), 'REMOVED_EXACT_ENOENT')
            with self.assertRaises(FileNotFoundError): root.lstat()

    def test_admission_binds_claim_clean_head_window_and_full_sum(self):
        permit = self.permit()
        facts = {'claimId': 'a8a3b2d7-1bde-438a-9fbf-f81e1c791350', 'version': 1, 'state': 'ACTIVE', 'taskId': 'S01Q01',
          'worktree': str(entry.ROOT), 'branch': 'codex/queue-paused-scan', 'head': permit['head'], 'clean': True,
          'observedEpoch': 900, 'window': permit['window'], 'windowGranted': True, 'requiredFreeBytes': 1, 'resourceTerms': {'reserve': 1},
          'scopes': ['apps/server/src/conversation-queue/promotion.ts', 'apps/server/src/conversation-queue/queue.test.ts', 'docs/evidence/s01q01-paused-queue', 'plans/s01q01-paused-queue']}
        entry.validate_admission(facts, permit, 910, permit['head'], facts['branch'], '')
        for key, value in [('version', 2), ('observedEpoch', 800), ('clean', False), ('windowGranted', False), ('resourceTerms', {'reserve': 2})]:
            with self.assertRaises(ValueError): entry.validate_admission({**facts, key: value}, permit, 910, permit['head'], facts['branch'], '')
        with self.assertRaisesRegex(ValueError, 'HEAD_OR_DIRTY'): entry.validate_admission(facts, permit, 910, 'd' * 40, facts['branch'], '')
        with self.assertRaisesRegex(ValueError, 'HEAD_OR_DIRTY'): entry.validate_admission(facts, permit, 910, permit['head'], facts['branch'], ' M file')

    def test_private_url_errors_do_not_reveal_value(self):
        for value in ['postgresql://127.0.0.1/postgres?host=other', 'postgresql://127.0.0.1/postgres#', 'postgresql://[private-secret']:
            with self.assertRaisesRegex(ValueError, '^LOCAL_ADMIN_REQUIRED$'): entry.admin_input(value)


if __name__ == '__main__': unittest.main()
