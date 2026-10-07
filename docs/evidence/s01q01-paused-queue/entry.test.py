import importlib.util
import hashlib
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
        result = {'success': True, 'testResults': [{'status': 'passed', 'assertionResults': [{'title': name, 'status': 'passed'} for name in entry.TEST_NAMES]}]}
        self.assertTrue(entry.selected_passed(result))
        result['testResults'][0]['assertionResults'].append({'title': 'unrelated', 'status': 'passed'})
        self.assertFalse(entry.selected_passed(result))

    def test_failed_assertion_stays_failed(self):
        result = {'success': False, 'testResults': [{'status': 'passed', 'assertionResults': [{'title': name, 'status': 'passed'} for name in entry.TEST_NAMES]}]}
        self.assertFalse(entry.selected_passed(result))

    def selected_result(self):
        return {'success': True, 'testResults': [{'status': 'passed', 'assertionResults': [{'title': name, 'status': 'passed'} for name in entry.TEST_NAMES]}]}

    def test_only_known_unselected_statuses_are_accepted(self):
        result = self.selected_result()
        result['testResults'][0]['assertionResults'] += [{'title': 'unrelated', 'status': status} for status in ['pending', 'skipped']]
        self.assertTrue(entry.selected_passed(result))

    def test_missing_duplicate_failed_extra_or_unknown_assertion_is_rejected(self):
        import copy
        original = self.selected_result()
        mutations = [
          lambda rows: rows.pop(),
          lambda rows: rows.append(dict(rows[0])),
          lambda rows: rows[0].update(status='failed'),
          lambda rows: rows[0].update(status='skipped'),
          lambda rows: rows.append({'title': 'extra', 'status': 'passed'}),
          lambda rows: rows.append({'title': 'extra', 'status': 'future-unknown'}),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                result = copy.deepcopy(original); mutate(result['testResults'][0]['assertionResults'])
                self.assertFalse(entry.selected_passed(result))

    def test_suite_failure_and_malformed_report_are_rejected(self):
        result = self.selected_result(); result['testResults'][0]['status'] = 'failed'
        self.assertFalse(entry.selected_passed(result))
        result = self.selected_result(); result['numFailedTestSuites'] = 1
        self.assertFalse(entry.selected_passed(result))
        for bad in [None, {}, {'success': True, 'testResults': None}, {'success': True, 'testResults': []}]:
            self.assertFalse(entry.selected_passed(bad))

    def test_fixed_original_pg_report_decodes_without_rewriting_caller_failure(self):
        import json, hashlib
        root = Path(__file__).parent / 'pg-run-4799eda499494ac79f211b89ead71ea8'
        report = root / 'vitest.json'; old = root / 'result.json'
        before = (hashlib.sha256(report.read_bytes()).hexdigest(), hashlib.sha256(old.read_bytes()).hexdigest())
        self.assertTrue(entry.selected_passed(json.loads(report.read_text())))
        self.assertFalse(json.loads(old.read_text())['testPassed'])
        self.assertEqual(before, (hashlib.sha256(report.read_bytes()).hexdigest(), hashlib.sha256(old.read_bytes()).hexdigest()))

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

    def admission(self, permit):
        return {'claimId': 'a8a3b2d7-1bde-438a-9fbf-f81e1c791350', 'version': 1, 'state': 'ACTIVE', 'taskId': 'S01Q01',
          'worktree': str(entry.ROOT), 'branch': 'codex/queue-paused-scan', 'head': permit['head'], 'clean': True,
          'observedEpoch': 900, 'window': permit['window'], 'windowGranted': True, 'requiredFreeBytes': 1, 'resourceTerms': {'reserve': 1},
          'scopes': ['apps/server/src/conversation-queue/promotion.ts', 'apps/server/src/conversation-queue/queue.test.ts', 'docs/evidence/s01q01-paused-queue', 'plans/s01q01-paused-queue']}

    def test_admission_binds_claim_clean_head_window_and_full_sum(self):
        permit = self.permit(); facts = self.admission(permit)
        entry.validate_admission(facts, permit, 910, permit['head'], facts['branch'], '')
        for key, value in [('version', 2), ('observedEpoch', 800), ('clean', False), ('windowGranted', False), ('resourceTerms', {'reserve': 2})]:
            with self.assertRaises(ValueError): entry.validate_admission({**facts, key: value}, permit, 910, permit['head'], facts['branch'], '')
        with self.assertRaisesRegex(ValueError, 'HEAD_OR_DIRTY'): entry.validate_admission(facts, permit, 910, 'd' * 40, facts['branch'], '')
        with self.assertRaisesRegex(ValueError, 'HEAD_OR_DIRTY'): entry.validate_admission(facts, permit, 910, permit['head'], facts['branch'], ' M file')

    def test_replaced_root_symlink_never_deletes_original_files(self):
        with tempfile.TemporaryDirectory() as value:
            parent = Path(value).resolve(); root = parent / 'owned'; moved = parent / 'moved'
            root.mkdir(); (root / 'data').write_bytes(b'original')
            sample = entry.sample_tree(root, time.monotonic() + 1, 64)
            root.rename(moved); root.symlink_to(moved, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, 'NAMESPACE_CHANGED'): entry.remove_sampled(root, sample, time.monotonic() + 1)
            self.assertEqual((moved / 'data').read_bytes(), b'original')
            self.assertTrue(root.is_symlink())

    def test_root_is_rechecked_between_sampled_deletions(self):
        with tempfile.TemporaryDirectory() as value:
            parent = Path(value).resolve(); root = parent / 'owned'; moved = parent / 'moved'
            root.mkdir(); (root / 'a').write_text('a'); (root / 'b').write_text('b')
            sample = entry.sample_tree(root, time.monotonic() + 1, 64)
            original_unlink = Path.unlink; deleted = []
            def replace_after_first(path, *args, **kwargs):
                original_unlink(path, *args, **kwargs); deleted.append(path.name)
                root.rename(moved); root.symlink_to(moved, target_is_directory=True)
            with patch.object(Path, 'unlink', replace_after_first):
                with self.assertRaisesRegex(ValueError, 'NAMESPACE_CHANGED'): entry.remove_sampled(root, sample, time.monotonic() + 1)
            self.assertEqual(len(deleted), 1)
            survivor = 'b' if deleted[0] == 'a' else 'a'
            self.assertEqual((moved / survivor).read_text(), survivor)

    def test_run_reads_external_sibling_admission_before_namespace_or_child(self):
        permit = self.permit(); now = time.time(); permit['expiresEpoch'] = now + 200
        data = b'fixed runtime manifest'; permit['inputSha256'] = hashlib.sha256(data).hexdigest()
        facts = self.admission(permit); facts['observedEpoch'] = now
        external = Path('/synthetic-external/window-permit.json'); calls = []
        def read(path, limit):
            calls.append(path)
            if path == external: return permit
            if path == entry.HERE / 'runtime-inputs.json': return {}
            if path == external.with_name('window-permit-admission.json'): return facts
            raise AssertionError('unexpected read')
        with patch.object(entry, 'read_json', side_effect=read), patch.object(Path, 'read_bytes', return_value=data), patch.object(entry, 'verify_inputs'), patch.object(entry, 'current_git', return_value=(permit['head'], facts['branch'], '')), patch.object(entry, 'admin_input', side_effect=RuntimeError('ADMISSION_REACHED')), patch.object(Path, 'mkdir') as mkdir:
            with self.assertRaisesRegex(RuntimeError, 'ADMISSION_REACHED'): entry.run(external)
            mkdir.assert_not_called()
        self.assertEqual(calls[-1], external.with_name('window-permit-admission.json'))

    def test_run_rejects_tree_local_permit_before_admission_or_namespace(self):
        permit = self.permit(); permit['expiresEpoch'] = time.time() + 200
        data = b'fixed runtime manifest'; permit['inputSha256'] = hashlib.sha256(data).hexdigest()
        with patch.object(entry, 'read_json', side_effect=[permit, {}]) as read, patch.object(Path, 'read_bytes', return_value=data), patch.object(entry, 'verify_inputs'), patch.object(entry, 'current_git') as git, patch.object(Path, 'mkdir') as mkdir:
            with self.assertRaisesRegex(ValueError, 'EXTERNAL_PERMIT_REQUIRED'): entry.run(entry.HERE / 'actual-permit.json')
            self.assertEqual(read.call_count, 2); git.assert_not_called(); mkdir.assert_not_called()

    def test_private_url_errors_do_not_reveal_value(self):
        for value in ['postgresql://127.0.0.1/postgres?host=other', 'postgresql://127.0.0.1/postgres#', 'postgresql://[private-secret']:
            with self.assertRaisesRegex(ValueError, '^LOCAL_ADMIN_REQUIRED$'): entry.admin_input(value)


if __name__ == '__main__': unittest.main()
