"""Cross the actual caller up to injected OPS14 launch; never spawn native."""
from pathlib import Path
import contextlib
import datetime
import hashlib
import importlib.util
import json
import os
import shutil
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SOURCE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('o16_actual_home_run', SOURCE / 'run.py')
run = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run)
real_load = run.load
ops = real_load('test_real_home_ops', run.SUPERVISOR)
policy = real_load('test_real_home_policy', SOURCE / 'home_factor.py')
old = real_load('test_real_existing_status', run.OLD_CALLER)
meter = real_load('test_real_private_meter', run.METER)
parser = real_load('test_real_status_parser', run.PARSER)


def pin(path):
    return dict(path=str(path), realpath=str(path.resolve()), bytes=path.stat().st_size,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest())


def write(path, value):
    path.write_text(json.dumps(value))


def grant(preparation_sha, now):
    return dict(logicalId=run.LOGICAL_ID, state='SELECTED', preparationSHA256=preparation_sha,
                claim=run.CLAIM, worktree=str(run.ROOT),
                normalAuthenticationWritesAccepted=True, selectedAt=(now-datetime.timedelta(seconds=2)).isoformat(),
                latestStart=(now+datetime.timedelta(seconds=20)).isoformat(), minimumFreshFreeBytes=1100000000)


@contextlib.contextmanager
def fixture():
    with tempfile.TemporaryDirectory(prefix='home-caller-', dir=os.environ['TMPDIR']) as directory:
        root = Path(directory)
        base = root / 'candidate'
        base.mkdir()
        shutil.copyfile(SOURCE / 'run.py', base / 'run.py')
        (base / 'prepare.mjs').write_text('synthetic preparation placeholder; never executed')
        native = base / 'synthetic-native-never-executed'
        native.write_text('synthetic')
        preparation = dict(pins=[pin(SOURCE / 'run.py'), pin(run.OLD_CALLER), pin(run.SUPERVISOR)],
                           python={'realpath': str(Path(sys.executable).resolve())})
        write(base / 'execution-preparation.json', preparation)
        g = grant(run.sha(base / 'execution-preparation.json'), datetime.datetime.now(datetime.timezone.utc))
        g['worktree'] = str(root)
        write(base / 'execution-grant.json', g)
        queue = root / 'queue.json'
        write(queue, dict(O16HomeFactorGrant=g, actualHolder=None, currentActual=None, floor=1100000000))
        with patch.multiple(run, BASE=base, ROOT=root, RUN=root / 'actual', QUEUE=queue):
            yield root, base, native


def stopped_report(exit_code=0, stdout=b''):
    result = ops.Report(exit_code=exit_code, stdout=stdout, owned_state='absent',
                        eof={'stdout': True, 'stderr': True})
    if exit_code:
        result.fail('work', 'CHILD_EXIT_NONZERO')
    return result


def module_at(name, path):
    if path == run.SUPERVISOR:
        return ops
    if path == run.METER:
        return meter
    if path == run.PARSER:
        return parser
    if path == run.OLD_CALLER:
        return old
    if path.name == 'home_factor.py':
        return policy
    return real_load(name, path)


class ActualCaller(unittest.TestCase):
    def test_explicit_once_arguments_reject_before_io(self):
        for args in ([], ['--run'], ['--run-home-factor-once', 'B'], ['--selfcheck']):
            with patch.object(run, 'read_json', side_effect=AssertionError('unexpected IO')):
                with self.assertRaisesRegex(ValueError, '^EXPLICIT_ONCE_ENTRY_REQUIRED$'):
                    run.main(args)

    def test_grant_identity_lifetime_and_holder_are_required(self):
        now = datetime.datetime.now(datetime.timezone.utc)
        g = grant('fixed', now)
        q = dict(O16HomeFactorGrant=g, actualHolder=None, currentActual=None, floor=1100000001)
        self.assertEqual(run.validate_grant(g, q, 'fixed', now), 1100000001)
        for changed in ({**q, 'actualHolder': {'owner': 'other'}}, {**q, 'O16HomeFactorGrant': {}}):
            with self.assertRaises(ValueError):
                run.validate_grant(g, changed, 'fixed', now)
        with self.assertRaisesRegex(ValueError, '^GRANT_EXPIRED$'):
            run.validate_grant(g, q, 'fixed', now + datetime.timedelta(minutes=1))

    def test_actual_fixed_pin_mismatch_is_refused(self):
        row = pin(SOURCE / 'run.py')
        row['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, '^FIXED_INPUT_CHANGED$'):
            run.verify_pins({'pins': [row]})

    def test_actual_main_reserves_and_calls_real_policy_shape_without_child(self):
        with fixture() as (root, base, native):
            observed = []
            def stop_at_supervise(launch, budget):
                ops._validate(launch, budget)
                observed.append((launch, budget))
                self.assertEqual(launch.argv[2:4], (str(base / 'run.py'), '--worker'))
                self.assertEqual(launch.ownership, ops.Ownership.CHILD_PID_ONLY)
                self.assertLessEqual(budget.work_seconds + budget.term_grace_seconds + budget.kill_grace_seconds, 45)
                return stopped_report()
            with patch.object(run, 'load', side_effect=module_at), patch.object(ops, 'supervise', side_effect=stop_at_supervise), patch.object(Path, 'cwd', return_value=root):
                run.main(['--run-home-factor-once'])
                self.assertEqual(len(observed), 1)
                self.assertTrue((run.RUN / 'outer-reservation.json').is_file())
                result = run.read_json(run.RUN / 'outer-result.json')
                self.assertFalse(result['rawArchivedOrHashed'])
                self.assertEqual(result['private'], 'KEEP')
                with self.assertRaisesRegex(ValueError, '^NAMESPACE_OR_RESOURCE_GATE$'):
                    run.main(['--run-home-factor-once'])
                self.assertEqual(len(observed), 1)

    def test_symlink_namespace_is_refused_without_launch(self):
        with fixture() as (root, base, native):
            run.RUN.symlink_to(root / 'missing')
            with patch.object(Path, 'cwd', return_value=root), patch.object(run, 'load', side_effect=AssertionError('launch import forbidden')):
                with self.assertRaisesRegex(ValueError, '^NAMESPACE_OR_RESOURCE_GATE$'):
                    run.main(['--run-home-factor-once'])

    def worker_path(self, fail_a=False, too_late=False):
        with fixture() as (root, base, native):
            run.RUN.mkdir()
            deadline = str(time.monotonic() + (1 if too_late else 40))
            write(run.RUN / 'outer-reservation.json', dict(parentPid=os.getppid(), workerDeadline=deadline, logicalId=run.LOGICAL_ID))
            launches = []
            original_temp = tempfile.mkdtemp
            def scoped_temp(**kwargs):
                return original_temp(prefix=kwargs['prefix'], dir=root)
            def simulate(launch, budget):
                ops._validate(launch, budget)
                launches.append(launch)
                if len(launches) == 1:
                    scratch = Path(run.read_json(run.RUN / 'reservation.json')['scratch']['path'])
                    home = scratch / 'native/home'
                    env = dict(HOME=str(home), CLAUDE_CONFIG_DIR=str(home.parent/'config'), TMPDIR=str(home.parent/'tmp'),
                        CLAUDE_TMPDIR=str(home.parent/'tmp'), CLAUDE_SECURESTORAGE_CONFIG_DIR='', USER='citrine',
                        PATH='/usr/bin:/bin:/usr/sbin:/sbin', LANG='C.UTF-8', DISABLE_AUTOUPDATER='1', DISABLE_TELEMETRY='1',
                        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1', CLAUDE_CODE_ENTRYPOINT='sdk-ts',
                        CLAUDE_AGENT_SDK_VERSION='0.3.290', CLAUDE_CODE_SDK_READS_SESSION_STATE='1')
                    write(run.RUN/'prepared.json', {'binding': {'folders': {'home': {'path': str(home)}},
                        'runtime': [{}, {}, pin(native)]}, 'environment': env})
                    return stopped_report()
                self.assertEqual(launch.argv, (str(native), 'auth', 'status', '--json'))
                if fail_a:
                    return stopped_report(1, b'{"loggedIn":false,"email":"synthetic-private"}')
                return stopped_report(1, b'{"loggedIn":false,"authMethod":"none","apiProvider":"firstParty","email":"synthetic-private"}')
            with patch.object(run, 'load', side_effect=module_at), patch.object(ops, 'supervise', side_effect=simulate), patch.object(run.tempfile, 'mkdtemp', side_effect=scoped_temp):
                if too_late:
                    with self.assertRaisesRegex(ValueError, '^PREPARATION_DEADLINE$'):
                        run.worker(deadline)
                    self.assertEqual(launches, [])
                    return
                run.worker(deadline)
            self.assertEqual(len(launches), 2 if fail_a else 3)
            self.assertEqual((run.RUN/'b-consumed.json').exists(), not fail_a)
            if not fail_a:
                a, b = launches[1:]
                self.assertEqual([key for key in a.env if a.env[key] != b.env[key]], ['HOME'])
                self.assertEqual(a.cwd, b.cwd)
            public = (run.RUN/'a-observation.json').read_text()
            self.assertNotIn('synthetic-private', public)
            self.assertNotIn('stdout', public.split('"eof"')[0])

    def test_actual_worker_consumes_a_then_b_once(self):
        self.worker_path()

    def test_actual_worker_unknown_a_does_not_consume_b(self):
        self.worker_path(fail_a=True)

    def test_actual_worker_deadline_prevents_all_children(self):
        self.worker_path(too_late=True)


if __name__ == '__main__':
    if sys.argv[1:] != ['--selected-home-caller']:
        raise SystemExit('EXPLICIT_SELECTION_REQUIRED')
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ActualCaller)
    count = suite.countTestCases()
    if count != 8:
        raise SystemExit('SELECTION_MISMATCH')
    result = unittest.TextTestRunner().run(suite)
    print(json.dumps({'selected': count, 'passed': count-len(result.errors)-len(result.failures),
                      'nativeChildSpawns': 0, 'queryCalls': 0, 'personalReads': 0}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
