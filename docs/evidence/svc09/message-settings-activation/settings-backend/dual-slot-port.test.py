from pathlib import Path
import importlib.util, sys, unittest
from types import SimpleNamespace
P=Path(__file__).resolve().parent.parent/'host-integration/host-run.py'
spec=importlib.util.spec_from_file_location('svc09_dual_port',P)
operator=importlib.util.module_from_spec(spec);sys.modules[spec.name]=operator;spec.loader.exec_module(operator)
PURPOSE='SVC09A_FIXED_SETTINGS_DUAL_SLOT'
class DualPort(unittest.TestCase):
    def test_work_failure_preserves_cleanup_on_pinned_successor_entries(self):
        calls=[];saved=[];result={};entries=['/fixed/settings-entry.mjs']*2
        def child(argv,seconds,reserve,output):
            calls.append((argv,seconds,reserve,output))
            return SimpleNamespace(exit_code=1 if len(calls)==1 else 0,first_failure='PRIMARY' if len(calls)==1 else None,
                owned_state='absent',eof={'stdout':True,'stderr':True},stdout=b'',stderr=b'',pid=100,ownership='test')
        operator.work_and_cleanup(child,['node'],Path('/records'),Path('/private/fixed'),result,
            write=lambda p,v:saved.append((p,v)),purpose=PURPOSE,entries=entries)
        self.assertEqual([x[0][1:3] for x in calls],[[entries[0],'--work-once'],[entries[1],'--cleanup-once']])
        self.assertEqual([(x[1],x[2]) for x in calls],[(180,32),(30,2)])
        self.assertEqual(result['work']['firstFailure'],'PRIMARY');self.assertFalse(result['complete'])
        self.assertEqual(len(saved),3)
    def test_new_purpose_requires_explicit_attempt_and_pinned_entries(self):
        with self.assertRaisesRegex(AssertionError,'EXPLICIT_ATTEMPT_REQUIRED'):
            operator.main(['--execute-host-once'],attempt_purpose=PURPOSE)
        with self.assertRaisesRegex(AssertionError,'EXPLICIT_COLD_ENTRIES_REQUIRED'):
            operator.work_and_cleanup(lambda *a: self.fail('No child'),[],Path('/records'),Path('/private/fixed'),{},purpose=PURPOSE)
if __name__=='__main__':unittest.main()
