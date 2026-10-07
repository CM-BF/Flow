import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent

class ColdSuccessor(unittest.TestCase):
    def test_actual_successor_dispatch_and_original_refusal(self):
        spec = importlib.util.spec_from_file_location('cold_r2', HERE / 'recovery-cold-r2-run.py')
        entry = importlib.util.module_from_spec(spec); spec.loader.exec_module(entry)
        caller = entry.caller; dispatch = json.loads((HERE / 'recovery-cold-r2-dispatch.json').read_bytes())
        fixed = json.loads(caller.fixed_bytes(dispatch['input'])); prep = json.loads(caller.fixed_bytes(dispatch['preparation']))
        self.assertEqual(fixed['sourceHead'], '880060a317cd99f3f29b41333f6dd7d7f5ab1488')
        self.assertEqual(fixed['artifact']['artifactId'], 'e15dd368379a2be90b3c0c9d083cf27f9c26770e425e60e8cf078a127c9f15dd')
        original_load = caller.load; calls = []
        def load_only(pin, name):
            module = original_load(pin, name)
            if name.endswith('_work'):
                effective = module.preparation_bindings(prep)
                self.assertEqual(len(effective), 17)
                for value in effective + fixed['bindings']: module.pin(value)
            module.main = lambda argv, *, attempt: calls.append((name, argv, attempt)) or 0
            return module
        caller.load = load_only
        old_result = (HERE / 'recovery-cold-once/result.json').read_bytes()
        with self.assertRaises(ValueError): entry.main([])
        with self.assertRaises(AssertionError): caller.main(['--run-fixed-cold-once'])
        self.assertEqual(calls, [])
        self.assertEqual(entry.main(['--run-fixed-cold-once']), 0)
        self.assertEqual(entry.main(['--execute-cold-once']), 0)
        self.assertEqual(calls[0][2]['outerName'], 'recovery-cold-r2-outer-once')
        self.assertEqual(calls[0][2]['operatorName'], 'recovery-cold-r2-once')
        self.assertEqual(calls[1][2]['namespace'], str(HERE / 'recovery-cold-r2-once'))
        self.assertEqual(calls[1][2]['entries'], [str(HERE / 'recovery-cold-r2-entry.mjs')] * 2)
        self.assertFalse((HERE / 'recovery-cold-r2-once').exists())
        self.assertFalse((HERE / 'recovery-cold-r2-outer-once').exists())
        self.assertEqual((HERE / 'recovery-cold-once/result.json').read_bytes(), old_result)

if __name__ == '__main__': unittest.main()
