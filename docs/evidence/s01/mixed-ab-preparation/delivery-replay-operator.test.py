"""Pure caller safety checks: synthetic inputs only, no processes/FS/PG operations."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('replay_operator', Path(__file__).with_name('delivery-replay-operator.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReplayCallerTests(unittest.TestCase):
    def test_explicit_environment_does_not_inherit_poison_or_secrets(self):
        poison = {'NODE_OPTIONS': '--require attacker', 'PGPASSWORD': 'synthetic', 'FLOW_S01_ADMIN_URL': 'synthetic',
                  'PYTHONPATH': 'synthetic', 'HTTP_PROXY': 'synthetic', 'HOME': 'synthetic', 'FLOW_S01_REPLAY_OPEN': 'synthetic'}
        with patch.dict(module.os.environ, poison, clear=True):
            value = module.environment(Path('/tmp/owned-fixture'))
        self.assertFalse(set(poison) & set(value))
        self.assertEqual(value['TMPDIR'], '/tmp/owned-fixture')
        self.assertEqual(value['NODE_DISABLE_COMPILE_CACHE'], '1')
        self.assertEqual(value['TSX_DISABLE_CACHE'], '1')

    def test_unknown_process_or_eof_cannot_authorize_tmp_cleanup(self):
        raw = b'four'
        base = dict(exit_code=0, owned_state='absent', capture='merged', eof={'stdout': True}, secondary_failures=[],
                    first_failure=None, signals=[], stdout=raw, stderr=b'', observed_bytes=4, retained_bytes=4,
                    observations=[{'state': 'unknown', 'errno': 1}, {'state': 'absent', 'errno': None}])
        self.assertTrue(module.process_closed(SimpleNamespace(**base), raw))
        for update in ({'exit_code': None}, {'owned_state': 'unknown'}, {'eof': {}},
                       {'eof': {'stdout': False}}, {'capture': 'separate'}, {'eof': {'stdout': True, 'stderr': True}},
                       {'observed_bytes': 5}, {'retained_bytes': 3}, {'stdout': b'fake'}, {'stderr': b'extra'},
                       {'signals': [{'state': 'unknown'}]}, {'signals': [{}]},
                       {'secondary_failures': [{'operation': 'observe', 'errno': 1}]}):
            self.assertFalse(module.process_closed(SimpleNamespace(**(base | update)), raw))
        for code in ('SIGNAL_UNKNOWN', 'CAPTURE_CLOSE_FAILED', 'OUTPUT_LIMIT_EXCEEDED', 'STOP_UNKNOWN', 'DEADLINE_EXCEEDED'):
            self.assertFalse(module.process_closed(SimpleNamespace(**(base | {'first_failure': {'code': code}})), raw))
        nonzero = base | {'exit_code': 1, 'first_failure': {'code': 'CHILD_EXIT_NONZERO'}}
        self.assertTrue(module.process_closed(SimpleNamespace(**nonzero), raw))
        self.assertNotEqual(nonzero['exit_code'], 0)  # Resource closure does not turn business failure green.

    def test_only_exact_prior_untracked_outputs_are_permitted(self):
        known = {'docs/evidence/s01/mixed-ab-preparation/delivery-replay-v2-caller-r1.raw'}
        path = next(iter(known))
        self.assertTrue(module.allowed_dirty('?? ' + path + '\0', known))
        self.assertTrue(module.allowed_dirty('', known))
        for status in (' M ' + path + '\0', '?? ' + path + '.other\0', '?? unknown.raw\0',
                       '?? docs/evidence/s01/mixed-ab-preparation/\0', 'R  ' + path + '\0elsewhere\0'):
            self.assertFalse(module.allowed_dirty(status, known))

    def test_cli_delivery_time_cannot_reuse_preprint_success(self):
        value = dict(mode='replay', successBeforePersistence=True, faults=[])
        clock = [9.0]
        def delayed_print(*args, **kwargs):
            self.assertTrue(kwargs['flush']); clock[0] = 11.0
        with patch('builtins.print', delayed_print), patch.object(module.time, 'monotonic', lambda: clock[0]):
            self.assertEqual(module.emit_result(value, 10.0), 1)
        self.assertTrue(value['successBeforePersistence'])

if __name__ == '__main__':
    unittest.main()
