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
        base = dict(exit_code=0, owned_state='absent', eof={'merged': True}, secondary_failures=[])
        self.assertTrue(module.process_closed(SimpleNamespace(**base)))
        for update in ({'exit_code': None}, {'owned_state': 'unknown'}, {'eof': {}},
                       {'eof': {'merged': False}}, {'secondary_failures': [{'operation': 'observe', 'errno': 1}]}):
            self.assertFalse(module.process_closed(SimpleNamespace(**(base | update))))

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
