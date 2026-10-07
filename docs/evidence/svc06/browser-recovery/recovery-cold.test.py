import ast
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
class ColdCaller(unittest.TestCase):
    def setUp(self):
        path = HERE / 'recovery-cold-run.py'; ast.parse(path.read_text())
        spec = importlib.util.spec_from_file_location('cold_fixed_parameter_test', path)
        self.caller = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.caller)

    def test_import_and_invalid_mode_do_not_read_missing_future_artifact_inputs(self):
        self.assertFalse((HERE / 'recovery-cold-dispatch.json').exists())
        for argv in ([], ['--run-default-host-once'], ['--execute-cold-once', 'extra']):
            with self.assertRaises(ValueError): self.caller.main(argv)
        self.assertFalse((HERE / 'recovery-cold-once').exists())
        self.assertFalse((HERE / 'recovery-cold-outer-once').exists())

    def test_exact_pin_rejects_modified_bytes_and_symlink(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'], prefix='cold-pin-') as temporary:
            directory = Path(temporary).resolve(); path = directory / 'input.json'; path.write_bytes(b'{}\n')
            pin = {'path': str(path), 'realpath': str(path), 'bytes': 3, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
            self.assertEqual(self.caller.fixed_bytes(pin), b'{}\n')
            path.write_bytes(b'[]\n')
            with self.assertRaises(AssertionError): self.caller.fixed_bytes(pin)
            link = directory / 'link.json'; link.symlink_to(path)
            with self.assertRaises(AssertionError): self.caller.fixed_bytes({**pin, 'path': str(link)})

if __name__ == '__main__': unittest.main()
