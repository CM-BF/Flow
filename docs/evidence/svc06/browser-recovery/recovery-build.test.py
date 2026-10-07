"""Actual fixed Python assembly import/argv and unchanged supervision-port contracts."""
import ast
import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
def module(name):
    path = HERE / name
    ast.parse(path.read_text())
    spec = importlib.util.spec_from_file_location(name.replace('.', '_'), path)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value

class RecoveryBuild(unittest.TestCase):
    def test_fixed_entries_import_and_reject_wrong_arguments_before_namespace(self):
        old, new = module('build-supervise.py'), module('recovery-build-supervise.py')
        self.assertFalse((HERE / 'recovery-build-once').exists())
        for entry in (old, new):
            with self.assertRaises(ValueError): entry.main([])
        self.assertFalse((HERE / 'recovery-build-once').exists())
        self.assertEqual(old.main.__kwdefaults__['output_path'], HERE / 'outer-report.json')
        self.assertEqual(old.main.__kwdefaults__['argument'], '--execute-fixed-build')
        self.assertEqual(old.main.__kwdefaults__['entry_path'], HERE / 'build-entry.mjs')

    def test_new_parent_precedes_exclusive_outer_and_duplicate_preserves_output(self):
        new = module('recovery-build-supervise.py')
        with tempfile.TemporaryDirectory(prefix='recovery-build-', dir=__import__('os').environ['TMPDIR']) as temporary:
            root = Path(temporary).resolve() / 'repo/docs/evidence/svc06/browser-recovery'; root.mkdir(parents=True)
            (root / 'build-supervise.py').write_bytes((HERE / 'build-supervise.py').read_bytes())
            fake = root / 'ops-fixture.py'
            fake.write_text('''from types import SimpleNamespace
class Ownership: NEW_CHILD_SESSION = "fixture"
def Launch(argv, cwd, env, ownership):
    assert argv[-1] == "--execute-fixed-recovery-build"
    return argv
def Policy(*args):
    assert args == (420, .5, 2, 1024 * 1024)
    return args
def supervise(launch, policy):
    return SimpleNamespace(exit_code=0, first_failure=None, owned_state="absent", eof={"stdout":True,"stderr":True}, stdout=b"", stderr=b"", elapsed_ms=0)
''')
            (root / 'recovery-build-inputs.json').write_text(json.dumps({'supervisor': {
                'path': str(fake), 'realpath': str(fake), 'sha256': hashlib.sha256(fake.read_bytes()).hexdigest()}}))
            new.HERE = root
            self.assertEqual(new.main(['--execute-fixed-recovery-build']), 0)
            directory = root / 'recovery-build-once'; output = directory / 'outer-report.json'
            self.assertEqual(directory.stat().st_mode & 0o777, 0o700)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            before = output.read_bytes()
            with self.assertRaises(FileExistsError): new.main(['--execute-fixed-recovery-build'])
            self.assertEqual(output.read_bytes(), before)
            self.assertFalse((directory / 'actual-first').exists())  # No builder was invoked.

if __name__ == '__main__': unittest.main()
