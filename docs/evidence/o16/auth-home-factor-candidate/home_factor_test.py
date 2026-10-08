"""Explicit pure consumers of the fixed parser and real OPS14 Report shape."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import sys
import unittest

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent


def fixed_module(name, path, expected=None):
    if expected is not None:
        assert hashlib.sha256(path.read_bytes()).hexdigest() == expected
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


policy = fixed_module('home_factor', BASE / 'home_factor.py')
parser = fixed_module('fixed_public_status_parser', BASE.parent / 'native-stages/auth-status-once.py',
                      '292fbba9bee04081c5dd68e1a8e5edf5748f0398eb658e6add62eb4dc4b32bf1')
ops = fixed_module('fixed_auth_ops14', Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py'),
                   '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d')
HOME = '/private/tmp/flow-o16-home-factor-synthetic/native/home'
ENV = dict(HOME=HOME, CLAUDE_CONFIG_DIR=HOME[:-4] + 'config', TMPDIR=HOME[:-4] + 'tmp',
           CLAUDE_TMPDIR=HOME[:-4] + 'tmp', CLAUDE_SECURESTORAGE_CONFIG_DIR='', USER='citrine',
           PATH='/usr/bin:/bin:/usr/sbin:/sbin', LANG='C.UTF-8', DISABLE_AUTOUPDATER='1',
           DISABLE_TELEMETRY='1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1',
           CLAUDE_CODE_ENTRYPOINT='sdk-ts', CLAUDE_AGENT_SDK_VERSION='0.3.290',
           CLAUDE_CODE_SDK_READS_SESSION_STATE='1')
NEGATIVE = dict(loggedIn=False, authMethod='none', apiProvider='firstParty')
POSITIVE = dict(loggedIn=True, authMethod='claude.ai', apiProvider='firstParty', subscriptionType='pro')


def report(exit_code=1):
    result = ops.Report(exit_code=exit_code, owned_state='absent', eof={'stdout': True, 'stderr': True})
    if exit_code != 0:
        result.fail('work', 'CHILD_EXIT_NONZERO')
    return result


def observe(value, lifecycle=None):
    return policy.interpret_status(json.dumps(value).encode(), lifecycle or report(), parser.safe_status)


class HomeFactor(unittest.TestCase):
    def test_home_is_the_only_environment_difference(self):
        before = copy.deepcopy(ENV)
        a, b = policy.home_cases(ENV, HOME)
        self.assertEqual(ENV, before)
        self.assertEqual([key for key in a if a[key] != b[key]], ['HOME'])
        self.assertEqual(b['HOME'], '/Users/citrine')

    def test_extra_credential_environment_is_rejected(self):
        with self.assertRaisesRegex(ValueError, '^HOME_RECIPE_MISMATCH$'):
            policy.home_cases({**ENV, 'ANTHROPIC_API_KEY': 'synthetic'}, HOME)

    def test_changed_sdk_or_config_is_rejected(self):
        for key, value in [('CLAUDE_AGENT_SDK_VERSION', 'other'), ('CLAUDE_CONFIG_DIR', '/wrong'),
                           ('USER', 'other'), ('CLAUDE_SECURESTORAGE_CONFIG_DIR', '/other')]:
            with self.assertRaisesRegex(ValueError, '^HOME_RECIPE_MISMATCH$'):
                policy.home_cases({**ENV, key: value}, HOME)

    def test_negative_exit_and_original_failure_are_preserved(self):
        lifecycle = report()
        before = copy.deepcopy(lifecycle)
        result = observe(NEGATIVE, lifecycle)
        self.assertEqual(result['decision'], 'CONTINUE')
        self.assertEqual(result['missingFields'], ['subscriptionType'])
        self.assertTrue(result['expectedNegativeStatus'])
        self.assertNotIn('subscriptionType', result['publicStatus'])
        self.assertEqual(lifecycle, before)

    def test_complete_positive_is_accepted(self):
        self.assertEqual(observe(POSITIVE, report(0))['decision'], 'CONTINUE')

    def test_positive_optional_missing_is_unknown(self):
        value = {key: val for key, val in POSITIVE.items() if key != 'subscriptionType'}
        self.assertEqual(observe(value, report(0))['decision'], 'STOP_UNKNOWN')

    def test_missing_required_fields_are_unknown(self):
        for field in ('loggedIn', 'authMethod', 'apiProvider'):
            self.assertEqual(observe({k: v for k, v in NEGATIVE.items() if k != field})['decision'], 'STOP_UNKNOWN')

    def test_invalid_values_cannot_become_optional_missing(self):
        for field, value in [('subscriptionType', 'secret'), ('authMethod', 'secret'), ('loggedIn', 'false')]:
            self.assertEqual(observe({**NEGATIVE, field: value})['decision'], 'STOP_UNKNOWN')

    def test_exit_status_must_match_the_public_result(self):
        for lifecycle in (report(0), report(2), report(-15)):
            self.assertEqual(observe(NEGATIVE, lifecycle)['decision'], 'STOP_UNKNOWN')
        self.assertEqual(observe(POSITIVE, report(1))['decision'], 'STOP_UNKNOWN')

    def test_other_primary_failure_is_not_overridden(self):
        for code in ('WORK_DEADLINE', 'OUTPUT_LIMIT', 'CHILD_IDENTITY_UNKNOWN'):
            lifecycle = report(0)
            lifecycle.exit_code = 1
            lifecycle.fail('work', code)
            self.assertEqual(observe(NEGATIVE, lifecycle)['decision'], 'STOP_UNKNOWN')

    def test_unknown_cleanup_or_secondary_failures_stop(self):
        variants = [dict(owned_state='unknown'), dict(eof={'stdout': True, 'stderr': False}),
                    dict(signals=[{'signal': 'TERM'}]), dict(secondary_failures=[{'code': 'UNKNOWN'}])]
        for change in variants:
            lifecycle = report()
            for key, value in change.items():
                setattr(lifecycle, key, value)
            self.assertEqual(observe(NEGATIVE, lifecycle)['decision'], 'STOP_UNKNOWN')

    def test_private_fields_and_malformed_output_are_never_returned(self):
        result = observe({**NEGATIVE, 'email': 'synthetic-private', 'orgName': 'synthetic-private'})
        self.assertNotIn('synthetic-private', json.dumps(result))
        result = policy.interpret_status(b'not-json-synthetic-private', report(), parser.safe_status)
        self.assertEqual(result['decision'], 'STOP_UNKNOWN')
        self.assertNotIn('synthetic-private', json.dumps(result))


if __name__ == '__main__':
    if sys.argv[1:] != ['--selected-home-factor']:
        raise SystemExit('EXPLICIT_SELECTION_REQUIRED')
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(HomeFactor)
    count = suite.countTestCases()
    if count != 12:
        raise SystemExit('SELECTION_MISMATCH')
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    print(json.dumps({'selected': count, 'passed': count - len(result.failures) - len(result.errors),
                      'nativeCalls': 0, 'queryCalls': 0, 'personalReads': 0}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
