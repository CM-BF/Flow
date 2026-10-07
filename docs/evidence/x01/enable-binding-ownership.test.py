"""In-memory tests of the X01 caller's consumption of fixed OPS14 Report facts."""
import hashlib
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


if hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() != '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d':
    raise RuntimeError('Fixed OPS14 input changed')
OPS = load('x01_report_contract', SUPERVISOR)
CALLER = load('x01_caller_under_test', HERE / 'enable-binding-check-once.py')


def complete_report(**overrides):
    values = {'pid': 123, 'exit_code': 0, 'stdout': b'git', 'observed_bytes': 3,
              'retained_bytes': 3, 'eof': {'stdout': True}, 'capture': 'merged',
              'owned_state': 'absent', 'ownership': 'newChildSession'}
    return OPS.Report(**(values | overrides))


class OwnershipConsumptionTests(unittest.TestCase):
    def test_confirmed_absence_preserves_historical_unknown_without_rejecting(self):
        history = [{'state': 'unknown', 'errno': 1}, {'state': 'absent', 'errno': None}]
        result = complete_report(observations=history)
        facts, uncertain = CALLER.supervision_facts(result, 'preflight')
        self.assertFalse(uncertain)
        self.assertTrue(facts['rawComplete'])
        self.assertEqual(facts['observations'], history)
        self.assertEqual(result.observations, history)
        self.assertEqual(facts['owned_state'], 'absent')
        self.assertNotIn('stdout', facts)

    def test_final_unknown_or_present_is_never_complete(self):
        for state in ['unknown', 'present']:
            with self.subTest(state=state):
                facts, uncertain = CALLER.supervision_facts(complete_report(owned_state=state), 'preflight')
                self.assertTrue(uncertain)
                self.assertFalse(facts['rawComplete'])

    def test_first_supervision_failure_survives_final_absence(self):
        failure = {'code': 'DEADLINE_EXCEEDED'}
        facts, uncertain = CALLER.supervision_facts(complete_report(first_failure=failure), 'strict')
        self.assertTrue(uncertain)
        self.assertEqual(facts['first_failure'], failure)

    def test_secondary_failure_survives_a_business_failure_and_final_absence(self):
        primary = {'code': 'CHILD_EXIT_NONZERO'}
        secondary = {'code': 'CAPTURE_CLOSE_FAILED'}
        facts, uncertain = CALLER.supervision_facts(complete_report(exit_code=2, first_failure=primary,
                secondary_failures=[secondary]), 'strict')
        self.assertTrue(uncertain)
        self.assertEqual(facts['first_failure'], primary)
        self.assertEqual(facts['secondary_failures'], [secondary])

    def test_signal_unknown_survives_final_absence(self):
        signals = [{'signal': 'SIGTERM', 'state': 'unknown', 'errno': 1}]
        facts, uncertain = CALLER.supervision_facts(complete_report(signals=signals), 'strict')
        self.assertTrue(uncertain)
        self.assertEqual(facts['signals'], signals)

    def test_missing_exit_eof_or_truncated_output_remains_unknown(self):
        for change in [{'exit_code': None}, {'eof': {'stdout': False}}, {'observed_bytes': 4}]:
            with self.subTest(change=change):
                facts, uncertain = CALLER.supervision_facts(complete_report(**change), 'strict')
                self.assertTrue(uncertain)
                self.assertFalse(facts['rawComplete'])

    def test_business_failure_can_have_complete_raw_but_keeps_failure_and_exit(self):
        failure = {'code': 'CHILD_EXIT_NONZERO'}
        facts, uncertain = CALLER.supervision_facts(complete_report(exit_code=2, first_failure=failure), 'strict')
        self.assertFalse(uncertain)
        self.assertTrue(facts['rawComplete'])
        self.assertEqual(facts['exit_code'], 2)
        self.assertEqual(facts['first_failure'], failure)


if __name__ == '__main__':
    unittest.main(verbosity=2)
