"""Pure caller seams only: no supervisor, child, PG, filesystem writes or real env reads."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('queue_operator_under_test', Path(__file__).with_name('queue-operator.py'))
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)
ADMIN = 'postgresql://synthetic:synthetic@127.0.0.1:55432/postgres'


class OnlyAuthorizedInputs:
    def __init__(self):
        self.read = []

    def get(self, key):
        self.read.append(key)
        if key == 'FLOW_S01_ADMIN_URL':
            return ADMIN
        if key == 'FLOW_S01_QUEUE_OPEN':
            return caller.WINDOW
        raise AssertionError('unapproved environment read')

    def __iter__(self):
        raise AssertionError('ambient environment enumeration')


class CallerEnvironmentTests(unittest.TestCase):
    def test_reads_only_two_explicit_inputs_and_drops_poison(self):
        source = OnlyAuthorizedInputs()
        result = caller.authorized_environment(source)
        self.assertEqual(source.read, ['FLOW_S01_QUEUE_OPEN', 'FLOW_S01_ADMIN_URL'])
        self.assertEqual(result['FLOW_S01_ADMIN_URL'], ADMIN)
        poison = {'FLOW_S01_QUEUE_OPEN': caller.WINDOW, 'FLOW_S01_ADMIN_URL': ADMIN,
                  'NODE_OPTIONS': '--import=poison', 'PYTHONPATH': '/poison', 'PGHOST': 'poison',
                  'PGPASSWORD': 'poison', 'HTTP_PROXY': 'poison', 'HTTPS_PROXY': 'poison',
                  'TOKEN': 'poison', 'HOME': '/poison', 'TMPDIR': '/poison', 'PATH': '/poison'}
        self.assertEqual(caller.authorized_environment(poison), result)
        self.assertEqual(result['TMPDIR'], '/tmp')
        self.assertEqual(result['PATH'], '/usr/bin:/bin')
        for key in poison.keys() - {'FLOW_S01_ADMIN_URL', 'TMPDIR', 'PATH'}:
            self.assertNotIn(key, result)

    def test_missing_authorization_is_rejected(self):
        for source in [{}, {'FLOW_S01_QUEUE_OPEN': 'wrong', 'FLOW_S01_ADMIN_URL': ADMIN},
                       {'FLOW_S01_QUEUE_OPEN': caller.WINDOW},
                       {'FLOW_S01_QUEUE_OPEN': caller.WINDOW, 'FLOW_S01_ADMIN_URL': 'bad\0value'}]:
            with self.assertRaises(ValueError):
                caller.authorized_environment(source)

    def test_git_uses_fixed_executable_without_admin(self):
        with patch.object(caller.subprocess, 'check_output', return_value=b'fixed\n') as execute:
            self.assertEqual(caller.git('rev-parse', 'HEAD'), 'fixed')
        args, options = execute.call_args
        self.assertEqual(args[0], ['/usr/bin/git', 'rev-parse', 'HEAD'])
        self.assertEqual(options['env'], caller.base_environment())
        self.assertNotIn('FLOW_S01_ADMIN_URL', options['env'])

    def test_exec_rebuilds_environment_without_open_or_poison(self):
        fake = {'FLOW_S01_ADMIN_URL': ADMIN, 'NODE_OPTIONS': '--import=poison', 'PGHOST': 'poison',
                'FLOW_S01_QUEUE_OPEN': caller.WINDOW}
        with patch.object(caller.os, 'environ', fake), patch.object(caller, 'save') as save, \
             patch.object(caller.os, 'execve') as execute:
            caller.child('a' * 40, '9125888000')
        self.assertEqual(save.call_count, 1)
        args = execute.call_args.args
        self.assertEqual(args[0], caller.NODE)
        self.assertEqual(args[2], caller.runtime_environment(ADMIN))
        self.assertNotIn('FLOW_S01_QUEUE_OPEN', args[2])

    def test_print_crossing_deadline_cannot_return_success(self):
        for before, after, verdict, expected in [(1, 2, 'PASS', 0), (299, 301, 'PASS', 1),
                                                (1, 2, 'FAIL_OR_UNKNOWN', 1)]:
            clock = [caller.STARTED + before]
            def delivery(*args, **kwargs):
                self.assertTrue(kwargs['flush'])
                clock[0] = caller.STARTED + after
            with patch.object(caller.time, 'monotonic', side_effect=lambda: clock[0]), \
                 patch('builtins.print', side_effect=delivery):
                self.assertEqual(caller.emit_result({'automaticVerdict': verdict}), expected)


if __name__ == '__main__':
    unittest.main()
