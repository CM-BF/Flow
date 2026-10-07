import importlib.util
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import unittest
import os

HERE = Path(__file__).resolve().parent

class SuccessorBuild(unittest.TestCase):
    def test_real_dispatch_parent_and_duplicate_preserve_original(self):
        spec = importlib.util.spec_from_file_location('recovery_r2', HERE / 'recovery-build-r2-supervise.py')
        value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
        with self.assertRaises(ValueError): value.main(['--execute-fixed-recovery-build'])
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as temporary:
            root = Path(temporary).resolve(); value.HERE = root; calls = []
            def lower(argv, **kwargs):
                self.assertEqual(argv, ['--execute-fixed-recovery-r2-build'])
                self.assertEqual(kwargs['inputs_path'], root / 'recovery-build-r2-inputs.json')
                self.assertEqual(kwargs['entry_path'], root / 'recovery-build-r2-entry.mjs')
                self.assertEqual(kwargs['argument'], argv[0])
                self.assertEqual((root / 'recovery-build-r2-once').stat().st_mode & 0o777, 0o700)
                with kwargs['output_path'].open('xb') as f: f.write(b'original')
                calls.append(kwargs); return 0
            fake = SimpleNamespace(main=lower)
            with patch.object(value.importlib.util, 'module_from_spec', return_value=fake), \
                 patch.object(value.importlib.util, 'spec_from_file_location', return_value=SimpleNamespace(loader=SimpleNamespace(exec_module=lambda module: None))):
                self.assertEqual(value.main(['--execute-fixed-recovery-r2-build']), 0)
                with self.assertRaises(FileExistsError): value.main(['--execute-fixed-recovery-r2-build'])
            self.assertEqual(len(calls), 1)
            self.assertEqual((root / 'recovery-build-r2-once/outer-report.json').read_bytes(), b'original')
            self.assertFalse((root / 'recovery-build-once').exists())

if __name__ == '__main__': unittest.main()
