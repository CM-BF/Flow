"""Exercise the frozen dispatch and real helper imports without launching an operator."""
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent

class FixedDispatch(unittest.TestCase):
    def test_actual_fixed_ports_and_unused_namespaces(self):
        spec = importlib.util.spec_from_file_location('cold_dispatch_actual', HERE / 'recovery-cold-run.py')
        caller = importlib.util.module_from_spec(spec); spec.loader.exec_module(caller)
        dispatch = json.loads((HERE / 'recovery-cold-dispatch.json').read_bytes())
        fixed = json.loads(caller.fixed_bytes(dispatch['input']))
        preparation = json.loads(caller.fixed_bytes(dispatch['preparation']))
        self.assertEqual(fixed['artifact']['artifactId'], 'b69296ade85aa19a767a28ab53a25ddd7e37841538f0120b346bc8f03f45810d')
        self.assertEqual(fixed['sourceHead'], 'f37a3612068c7215994750574a7451ede841bcce')
        self.assertNotIn('choices', fixed)
        original_load = caller.load
        calls = []
        def import_without_execution(pin, name):
            module = original_load(pin, name)
            if name.endswith('_work'):
                effective = module.preparation_bindings(preparation)
                self.assertIn(str(HERE / 'recovery-cold-entry.mjs'), [v['path'] for v in effective])
                for value in effective + fixed['bindings']: module.pin(value)
            module.main = lambda argv, *, attempt: calls.append((name, argv, attempt)) or 0
            return module
        caller.load = import_without_execution
        self.assertEqual(caller.main(['--run-fixed-cold-once']), 0)
        self.assertEqual(caller.main(['--execute-cold-once']), 0)
        self.assertEqual(calls[0][1], [])
        self.assertEqual(calls[0][2]['operator'], dispatch['operator'])
        self.assertEqual(calls[0][2]['argument'], '--execute-cold-once')
        self.assertEqual(calls[0][2]['outerName'], 'recovery-cold-outer-once')
        self.assertEqual(calls[1][2]['namespace'], str(HERE / 'recovery-cold-once'))
        self.assertEqual(calls[1][2]['entries'], [str(HERE / 'recovery-cold-entry.mjs')] * 2)
        self.assertFalse((HERE / 'recovery-cold-once').exists())
        self.assertFalse((HERE / 'recovery-cold-outer-once').exists())

if __name__ == '__main__': unittest.main()
