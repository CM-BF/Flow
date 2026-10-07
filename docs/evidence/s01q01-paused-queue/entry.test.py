import importlib.util
from pathlib import Path
import unittest
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

    def test_private_url_errors_do_not_reveal_value(self):
        for value in ['postgresql://127.0.0.1/postgres?host=other', 'postgresql://127.0.0.1/postgres#', 'postgresql://[private-secret']:
            with self.assertRaisesRegex(ValueError, '^LOCAL_ADMIN_REQUIRED$'): entry.admin_input(value)


if __name__ == '__main__': unittest.main()
