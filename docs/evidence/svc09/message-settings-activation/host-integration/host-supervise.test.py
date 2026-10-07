"""Only tiny owned children and injected persistence. No host, artifact, database or provider."""
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import unittest
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
