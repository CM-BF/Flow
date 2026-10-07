"""Only tiny owned children and injected persistence. No host, artifact, database or provider."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import unittest
from unittest.mock import patch
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module


outer = load('svc09a_outer_test', HERE / 'host-supervise.py')
operator = load('svc09a_operator_test', HERE / 'host-run.py')
fixed = json.loads((HERE / 'host-inputs.json').read_bytes())
ops = outer.load_supervisor(fixed['supervisor'])


class OperatorBoundary(unittest.TestCase):
    def test_attempt_arguments_bind_each_fixed_namespace_and_preparation(self):
        self.assertEqual(outer.attempt_files(['--run-host-once']),
            ('host-outer-once', 'actual-host-once', '--execute-host-once'))
        self.assertEqual(operator.attempt_files(['--execute-host-once']),
            ('actual-host-once', 'host-preparation.json'))
        names = outer.attempt_files(['--run-host-r2-once'])
        self.assertEqual(names, ('host-outer-r2-once', 'actual-host-r2-once', '--execute-host-r2-once'))
        self.assertEqual(operator.attempt_files([names[2]]), (names[1], 'host-preparation-r2.json'))
        names = outer.attempt_files(['--run-host-r3-once'])
        self.assertEqual(names, ('host-outer-r3-once', 'actual-host-r3-once', '--execute-host-r3-once'))
        self.assertEqual(operator.attempt_files([names[2]]), (names[1], 'host-preparation-r3.json'))
        names = outer.attempt_files(['--run-host-r4-once'])
        self.assertEqual(names, ('host-outer-r4-once', 'actual-host-r4-once', '--execute-host-r4-once'))
        self.assertEqual(operator.attempt_files([names[2]]), (names[1], 'host-preparation-r4.json'))

    def test_unknown_or_user_supplied_attempt_paths_are_rejected_before_io(self):
        for argv in ([], ['--run-host-r5-once'], ['--run-host-r4-once', '/tmp/arbitrary'], ['../other']):
            with self.assertRaisesRegex(AssertionError, 'EXACT_ARGUMENT_REQUIRED'):
                outer.attempt_files(argv)
        for argv in ([], ['--execute-host-r5-once'], ['--execute-host-r4-once', '/tmp/arbitrary']):
            with self.assertRaisesRegex(AssertionError, 'EXACT_ARGUMENT_REQUIRED'):
                operator.attempt_files(argv)

    def test_consumed_operator_or_outer_namespace_refuses_reuse_without_touching_old_attempt(self):
        scratch = Path(os.environ['FLOW_SVC09A_PREPARE_SCRATCH'])
        self.assertTrue(str(scratch).startswith(('/private/tmp/flow-svc09a-prepare-', '/private/tmp/flow-svc09a-host-')))
        old = scratch / 'actual-host-once'; old.mkdir()
        with self.assertRaisesRegex(AssertionError, 'OPERATOR_NAMESPACE_EXISTS'):
            outer.reserve_attempt(scratch, 'host-outer-once', old.name)
        self.assertFalse((scratch / 'host-outer-once').exists())
        reserved = outer.reserve_attempt(scratch, 'host-outer-r2-once', 'actual-host-r2-once')
        with self.assertRaises(FileExistsError):
            outer.reserve_attempt(scratch, 'host-outer-r2-once', 'actual-host-r2-once')
        self.assertTrue(old.is_dir()); reserved.rmdir()
        pending = scratch / 'actual-host-r2-once'; pending.mkdir()
        with self.assertRaisesRegex(AssertionError, 'OPERATOR_NAMESPACE_EXISTS'):
            outer.reserve_attempt(scratch, 'host-outer-r2-once', pending.name)
        self.assertFalse(reserved.exists()); pending.rmdir(); old.rmdir()
        r3 = outer.reserve_attempt(scratch, 'host-outer-r3-once', 'actual-host-r3-once')
        with self.assertRaises(FileExistsError):
            outer.reserve_attempt(scratch, 'host-outer-r3-once', 'actual-host-r3-once')
        r3.rmdir()
        r4 = outer.reserve_attempt(scratch, 'host-outer-r4-once', 'actual-host-r4-once')
        with self.assertRaises(FileExistsError):
            outer.reserve_attempt(scratch, 'host-outer-r4-once', 'actual-host-r4-once')
        r4.rmdir()
        pending = scratch / 'actual-host-r4-once'; pending.mkdir()
        with self.assertRaisesRegex(AssertionError, 'OPERATOR_NAMESPACE_EXISTS'):
            outer.reserve_attempt(scratch, 'host-outer-r4-once', pending.name)
        pending.rmdir()

    def test_delta_preparation_inherits_fixed_pins_without_dropping_or_adding_inputs(self):
        inherited = {'path': str(HERE / 'host-preparation-r3.json'),
            'sha256': 'd17e168f280f7cb2f18ba57347fcdb16895336063b774b9191ea7545607e7b8c'}
        previous = [{'path': f'/synthetic/{i}', 'sha256': 'old'} for i in range(19)]
        replacement = {**previous[0], 'sha256': 'new'}
        source = {'inherits': inherited, 'bindings': [replacement]}
        def read_pin(value):
            self.assertEqual(value, inherited)
            return json.dumps({'bindings': previous}).encode()
        self.assertEqual(operator.preparation_bindings(source, read_pin), [replacement, *previous[1:]])
        for values in ([replacement, replacement], [{'path': '/outside/fixed-set'}]):
            with self.assertRaisesRegex(AssertionError, 'REPLACEMENT_PIN_SET_INVALID'):
                operator.preparation_bindings({**source, 'bindings': values}, read_pin)
        with self.assertRaisesRegex(AssertionError, 'FIXED_PREPARATION_REQUIRED'):
            operator.preparation_bindings({**source, 'inherits': {**inherited, 'path': '/arbitrary'}}, read_pin)
        with self.assertRaises(AssertionError):
            operator.preparation_bindings({**source, 'inherits': {**inherited, 'sha256': 'wrong'}}, read_pin)
        with self.assertRaisesRegex(AssertionError, 'INHERITED_PIN_SET_INVALID'):
            operator.preparation_bindings(source, lambda _: json.dumps({'bindings': previous[:-1]}).encode())

    def test_work_environment_resolves_actual_listener_tool_missing_from_old_path(self):
        previous = '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin'
        self.assertIsNone(shutil.which('lsof', path=previous))
        environment = operator.work_environment(Path('/synthetic/owned'))
        self.assertEqual(shutil.which('lsof', path=environment['PATH']), '/usr/sbin/lsof')
        self.assertEqual(environment['PATH'], previous + ':/usr/sbin')
        self.assertEqual(shutil.which('ps', path=environment['PATH']), '/bin/ps')

    def test_work_environment_keeps_private_paths_and_does_not_inherit_credentials(self):
        with patch.dict(os.environ, {'HOME': '/unowned/home', 'PATH': '/unowned/bin',
                'FLOW_SVC09A_ADMIN_URL': 'synthetic-only', 'ANTHROPIC_API_KEY': 'synthetic-only'}, clear=True):
            environment = operator.work_environment(Path('/synthetic/owned'))
        self.assertEqual(set(environment), {'PATH', 'HOME', 'TMPDIR', 'CLAUDE_CONFIG_DIR',
            'PYTHONDONTWRITEBYTECODE', 'TSX_DISABLE_CACHE', 'NODE_DISABLE_COMPILE_CACHE'})
        self.assertEqual(environment['HOME'], '/synthetic/owned/home')
        self.assertEqual(environment['TMPDIR'], '/synthetic/owned/tmp')
        self.assertEqual(environment['CLAUDE_CONFIG_DIR'], environment['HOME'])
        self.assertEqual(environment['PYTHONDONTWRITEBYTECODE'], '1')
        self.assertEqual(environment['TSX_DISABLE_CACHE'], '1')
        self.assertEqual(environment['NODE_DISABLE_COMPILE_CACHE'], '1')

    def test_caller_deadline_covers_persistence_stall_and_retains_primary_output(self):
        scratch = Path(os.environ['FLOW_SVC09A_PREPARE_SCRATCH'])
        self.assertTrue(str(scratch).startswith('/private/tmp/flow-svc09a-review-'))
        path = scratch / 'synthetic-persistence.json'
        code = "import json,os,sys,time;print(json.dumps({'primary':'SYNTHETIC_WORK_FAILURE'}),flush=True);f=open(sys.argv[1],'x');f.write('{}');f.flush();os.fsync=lambda fd:time.sleep(30);os.fsync(f.fileno())"
        report = outer.supervise_operator(ops, [sys.executable, '-c', code, str(path)],
            {'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'}, work_seconds=.2)
        self.assertEqual(report.first_failure['code'], 'DEADLINE_EXCEEDED')
        self.assertEqual(report.ownership, 'childPidOnly'); self.assertEqual(report.owned_state, 'absent')
        self.assertTrue(all(report.eof.values())); self.assertLess(report.elapsed_ms, 2700)
        self.assertEqual(json.loads(report.stdout), {'primary': 'SYNTHETIC_WORK_FAILURE'})
        self.assertEqual(outer.disposition(report)['servicesAndDatabase'], 'UNKNOWN_KEEP')
        self.assertFalse(outer.disposition(report)['retry'])
        info = path.lstat(); self.assertTrue(stat.S_ISREG(info.st_mode)); self.assertEqual(info.st_uid, os.getuid()); self.assertEqual(info.st_nlink, 1)
        self.assertEqual(path.read_bytes(), b'{}'); path.unlink()

    def test_successful_caller_exit_cannot_prove_detached_resource_cleanup(self):
        report = outer.supervise_operator(ops, [sys.executable, '-c', "print('synthetic caller completed')"],
            {'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'}, work_seconds=.5)
        self.assertEqual(report.exit_code, 0); self.assertEqual(report.owned_state, 'absent'); self.assertTrue(all(report.eof.values()))
        value = outer.disposition(report)
        self.assertTrue(value['operatorReturned']); self.assertTrue(value['phaseRecordsRequired'])
        self.assertEqual(value['servicesAndDatabase'], 'NOT_INFERRED_FROM_CALLER_EXIT')

    def test_work_record_failure_still_runs_cleanup_without_replacing_primary(self):
        calls = []; writes = []
        first = {'code': 'SYNTHETIC_WORK_FAILURE'}
        def child(argv, *args):
            calls.append(argv)
            return ops.Report(pid=100+len(calls), ownership='newChildSession', exit_code=1 if len(calls) == 1 else 0,
                owned_state='absent', eof={'stdout': True, 'stderr': True}, first_failure=first if len(calls) == 1 else None)
        def persist(path, value):
            writes.append(path.name)
            if path.name == 'work-outer.json': raise OSError('injected persistence failure')
        result = {}
        operator.work_and_cleanup(child, ['fixed-node'], Path('/synthetic/run'), Path('/synthetic/owned'), result, write=persist)
        self.assertEqual(len(calls), 2); self.assertIn('--cleanup-once', calls[1])
        self.assertEqual(result['work']['firstFailure'], first)
        self.assertEqual(result['persistenceFailures'], [{'phase': 'work-record', 'type': 'OSError'}])
        self.assertEqual(result['cleanup']['exit'], 0); self.assertFalse(result['complete'])
        self.assertEqual(writes, ['work-outer.json', 'cleanup-outer.json'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
