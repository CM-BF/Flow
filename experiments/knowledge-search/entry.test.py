"""Bounded caller tests; synthetic report/env plus only caller-owned temporary paths."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import os, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('knowledge_entry',Path(__file__).with_name('entry.py'))
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
class EntryTests(unittest.TestCase):
    def report(self, **changes):
        return SimpleNamespace(**(dict(exit_code=0,owned_state='absent',capture='merged',eof={'stdout':True},
            observed_bytes=4,retained_bytes=4,stdout=b'four',stderr=b'',first_failure=None,secondary_failures=[],signals=[],
            observations=[{'state':'unknown','errno':1},{'state':'absent','errno':None}])|changes))
    def test_reaped_complete_capture_closes_despite_earlier_read_only_observation(self):
        self.assertTrue(module.process_closed(self.report(),b'four'))
        self.assertFalse(module.check_passed(self.report(exit_code=1,first_failure={'code':'CHILD_EXIT_NONZERO'}),True))
        self.assertTrue(module.process_closed(self.report(exit_code=1,first_failure={'code':'CHILD_EXIT_NONZERO'}),b'four'))
    def test_faults_cannot_grant_cleanup(self):
        for changed in ({'exit_code':None},{'owned_state':'unknown'},{'capture':'separate'},{'eof':{}},
          {'eof':{'stdout':False}},{'eof':{'stdout':True,'stderr':True}},{'observed_bytes':5},{'retained_bytes':3},
          {'stdout':b'fake'},{'stderr':b'extra'},{'secondary_failures':[{'code':'CLOSE_UNKNOWN'}]},
          {'signals':[{'state':'unknown'}]},{'signals':[{}]}):
            with self.subTest(changed=changed):self.assertFalse(module.process_closed(self.report(**changed),b'four'))
        for code in ['SIGNAL_UNKNOWN','CAPTURE_CLOSE_FAILED','OUTPUT_LIMIT_EXCEEDED','STOP_UNKNOWN','DEADLINE_EXCEEDED']:
            with self.subTest(code=code):self.assertFalse(module.process_closed(self.report(first_failure={'code':code}),b'four'))
    def test_environment_does_not_inherit_secrets_or_runtime_injection(self):
        poison={key:'synthetic' for key in ['HOME','NODE_OPTIONS','NODE_PATH','PYTHONPATH','PGPASSWORD','HTTP_PROXY','FLOW_K01_QUERY_ADMIN_URL']}
        with patch.dict(module.os.environ,poison,clear=True): env=module.environment(Path('/tmp/synthetic-owned'),0,{})
        self.assertFalse(set(poison)&set(env));self.assertEqual(env['TSX_DISABLE_CACHE'],'1')
        self.assertEqual(env['TMPDIR'],'/tmp/synthetic-owned');self.assertEqual(env['FLOW_K01_QUERY_PG_OPEN'],'NOT_OPEN')
    def test_new_namespace_normal_cleanup_is_exact_and_bounded(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as base:
            parent=Path(base); outside=parent/'outside'; outside.write_text('keep')
            path,identity=module.create_scratch(parent)
            (path/'nested').mkdir();(path/'nested'/'file').write_bytes(b'owned')
            result=module.cleanup_scratch(path,identity,True)
            self.assertTrue(result['absent']);self.assertFalse(path.exists());self.assertEqual(outside.read_text(),'keep')
    def test_unknown_identity_or_child_retains_namespace(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as base:
            path,identity=module.create_scratch(Path(base))
            self.assertFalse(module.cleanup_scratch(path,identity,False)['absent']);self.assertTrue(path.is_dir())
            bad=identity|{'ino':identity['ino']+1}
            self.assertFalse(module.cleanup_scratch(path,bad,True)['absent']);self.assertTrue(path.is_dir())
            self.assertTrue(module.cleanup_scratch(path,identity,True)['absent'])
    def test_unexpected_symlink_is_retained_without_following(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as base:
            parent=Path(base);outside=parent/'outside';outside.write_text('keep')
            path,identity=module.create_scratch(parent);(path/'link').symlink_to(outside)
            self.assertFalse(module.cleanup_scratch(path,identity,True)['absent']);self.assertEqual(outside.read_text(),'keep')
    def test_nonregular_marker_does_not_block_or_grant_cleanup(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as base:
            path,identity=module.create_scratch(Path(base));(path/'.owner.json').unlink();os.mkfifo(path/'.owner.json')
            self.assertFalse(module.cleanup_scratch(path,identity,True)['absent']);self.assertTrue(path.is_dir())
if __name__=='__main__':unittest.main()
