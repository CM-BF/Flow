"""Fixed mode/namespace/pin and work-to-cleanup ports, with no host/database child."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
def load(name, leaf):
    spec = importlib.util.spec_from_file_location(name, HERE / leaf)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module
operator = load('default_operator', 'host-run.py')
outer = load('default_outer', 'host-supervise.py')
PURPOSE = 'SVC09A_DEFAULT_THREE_ROLE_START_STOP'

class DefaultPorts(unittest.TestCase):
    def test_default_modes_are_one_exact_pair_and_exclusive(self):
        names = outer.attempt_files(['--run-default-host-once'])
        self.assertEqual(names, ('default-host-outer-once', 'actual-default-host-once', '--execute-default-host-once'))
        self.assertEqual(operator.attempt_files([names[2]]), (names[1], 'default-host-preparation.json'))
        for argv in (['--run-default-host-once', 'arbitrary'], ['--run-default-host-twice']):
            with self.assertRaises(AssertionError): outer.attempt_files(argv)
        scratch = Path(os.environ['FLOW_SVC09A_CONTROLLER_SCRATCH'])
        reserved = outer.reserve_attempt(scratch, names[0], names[1])
        try:
            with self.assertRaises(FileExistsError): outer.reserve_attempt(scratch, names[0], names[1])
        finally: reserved.rmdir()
        pending = scratch / names[1]; pending.mkdir()
        try:
            with self.assertRaisesRegex(AssertionError, 'OPERATOR_NAMESPACE_EXISTS'): outer.reserve_attempt(scratch, names[0], names[1])
        finally: pending.rmdir()

    def test_default_additions_retain_inherited_pins_and_reject_arbitrary_sources(self):
        r4 = json.loads((HERE / 'host-preparation-r4.json').read_bytes())
        old = operator.preparation_bindings(r4)
        new = [{'path': str(HERE / name), 'sha256': 'synthetic'} for name in
            ('default-host.mjs', 'controller-loader.mjs', 'controller-driver-inputs.json')]
        source = {'purpose': PURPOSE, 'inherits': {'path': str(HERE / 'host-preparation-r4.json'),
            'sha256': 'd38a5bfd4c211c24b34cb170adc4256a4207d2f0bfff1456e274337ce0915ae2'}, 'bindings': new}
        def read(pin):
            if pin['path'].endswith('host-preparation-r4.json'): return json.dumps(r4).encode()
            return operator.pin(pin)
        result = operator.preparation_bindings(source, read)
        self.assertEqual(result[:19], old); self.assertEqual(len(result), 22)
        for values in (new[:-1], new + [new[0]], new + [{'path': '/outside/arbitrary'}]):
            with self.assertRaises(AssertionError): operator.preparation_bindings({**source, 'bindings': values}, read)

    def test_default_work_and_cleanup_remain_supervised_and_preserve_first_failure(self):
        calls = []
        def child(argv, seconds, reserve, limit):
            calls.append((argv, seconds, reserve, limit))
            return SimpleNamespace(exit_code=1 if len(calls) == 1 else 0, owned_state='absent',
                eof={'stdout': True, 'stderr': True}, first_failure='timeout' if len(calls) == 1 else None,
                stdout=b'', stderr=b'', pid=123, ownership='new-child-session')
        result = {}
        operator.work_and_cleanup(child, ['fixed-node'], Path('/synthetic/run'), Path('/synthetic/root'), result,
            write=lambda *_: None, purpose=PURPOSE)
        self.assertTrue(all(Path(call[0][1]).name == 'default-host.mjs' for call in calls))
        self.assertEqual([call[0][2] for call in calls], ['--work-once', '--cleanup-once'])
        self.assertEqual(result['work']['firstFailure'], 'timeout'); self.assertFalse(result['complete'])
        self.assertEqual(calls[1][1:], (30, 2, 131072))
        with self.assertRaisesRegex(AssertionError, 'HOST_PURPOSE_MISMATCH'):
            operator.work_and_cleanup(child, [], Path('/a'), Path('/b'), {}, purpose='arbitrary')

if __name__ == '__main__': unittest.main(verbosity=2)
