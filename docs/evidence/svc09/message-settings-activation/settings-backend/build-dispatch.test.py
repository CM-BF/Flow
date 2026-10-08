"""Real dispatcher -> shared supervisor prelaunch/persistence, with only OPS child suppressed."""
import hashlib, importlib.util, json, os, sys, tempfile, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
HERE = Path(__file__).resolve().parent
SHARED = HERE.parent / 'host-integration/build/supervise.py'
OPS = Path('/Users/citrine/Projects/AgentHarness/Flow/tools/owned-process-supervision/supervise.py')
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec); sys.modules[name] = value; spec.loader.exec_module(value); return value
def pin(path):
    raw=path.read_bytes();return dict(path=str(path),realpath=str(path.resolve()),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())

class Dispatcher(unittest.TestCase):
    def test_exact_argument_rejects_before_io(self):
        caller=load('settings_bad_args',HERE/'build-supervise.py')
        with self.assertRaises(ValueError):caller.main(['--execute-fixed-build'])

    def test_real_chain_owns_exclusive_namespace_and_outer_before_child(self):
        caller=load('settings_dispatch',HERE/'build-supervise.py')
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as temporary:
            base=Path(temporary).resolve(); root=base/'settings-backend';root.mkdir()
            shared=base/'host-integration/build/supervise.py';shared.parent.mkdir(parents=True);shared.write_bytes(SHARED.read_bytes())
            (root/'build-inputs.json').write_text(json.dumps(dict(supervisor=pin(OPS))))
            (root/'build-preparation.json').write_text(json.dumps(dict(bindings=[],sharedSupervisor=pin(shared))))
            caller.HERE=root;calls=[]
            original=importlib.util.module_from_spec
            def module(spec):
                value=original(spec)
                if spec.name=='svc09a_build_ops14':
                    original_exec=spec.loader.exec_module
                    def install(loaded):
                        original_exec(loaded)
                        def no_child(launch,policy):
                            loaded._validate(launch,policy)
                            self.assertEqual(launch.argv[-1],'--execute-settings-build-once')
                            self.assertEqual(launch.argv[1],str(root/'build-entry.mjs'))
                            self.assertEqual((root/'build-once').stat().st_mode&0o777,0o700)
                            self.assertEqual((root/'build-once/outer-report.json').stat().st_mode&0o777,0o600)
                            self.assertFalse((root/'build-once/actual-first').exists())
                            self.assertEqual(policy.work_seconds,420)
                            calls.append(launch)
                            return SimpleNamespace(stdout=b'',stderr=b'',exit_code=0,first_failure=None,owned_state='absent',eof={'stdout':True,'stderr':True},elapsed_ms=0)
                        loaded.supervise=no_child
                    spec.loader.exec_module=install
                return value
            with patch.object(importlib.util,'module_from_spec',side_effect=module):
                self.assertEqual(caller.main(['--execute-settings-build-once']),0)
                original_outer=(root/'build-once/outer-report.json').read_bytes()
                with self.assertRaises(FileExistsError):caller.main(['--execute-settings-build-once'])
            self.assertEqual(len(calls),1)
            self.assertEqual((root/'build-once/outer-report.json').read_bytes(),original_outer)
            self.assertFalse((base/'host-integration/build/actual-first').exists())

if __name__=='__main__':unittest.main()
