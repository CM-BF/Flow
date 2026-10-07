"""Pure receipt/deadline counterexamples. No database, process spawn, or real root cleanup."""
import copy,importlib.util,pathlib,types,unittest,json
from unittest.mock import patch
p=pathlib.Path(__file__).with_name('execute-pg.py')
spec=importlib.util.spec_from_file_location('lazy_pg_gates',p);gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)

def valid():
 marker='11111111-2222-3333-4444-555555555555';db='flow_c02_'+'a'*32;identity={'oid':'123','marker':marker}
 fixture={'window':'w','sourceHead':'h','database':db,'databaseIdentity':identity,'creationRequested':True,'creationAcknowledged':True,'cleanup':{k:True for k in ['startupSettled','runnersClosed','appClosed','poolClosed','adminClosed','databaseIdentityConfirmed','databaseAbsent']},'retainedDatabase':None,'primaryPhases':[],'cleanupErrors':[],'cleanupComplete':True,'roots':[],'databaseLogicalBytes':1024,'httpRequests':45,'httpLimit':256,'configuredConnectionLimit':14,'nativeProcesses':0,'providerCalls':0}
 fixture['cleanup']['connections']=0
 return [fixture,{'pid':9,'pgid':9,'window':'w','head':'h'},{'database':db,'marker':marker,'pid':10},{'database':db,'marker':marker},{'database':db,'creationAcknowledged':True,'identity':identity}]

class Gates(unittest.TestCase):
 def test_confirmed_receipt_uses_child_checkpoint_and_worker_reservation_separately(self):
  gate.confirm_fixture(*valid(),'w','h',9)
 def test_foreign_partial_and_false_cleanup_never_confirm_or_delete(self):
  mutations=[lambda a:a[0].update(window='foreign'),lambda a:a[1].update(pid=99),lambda a:a[2].update(marker='foreign'),lambda a:a[3].update(database='foreign'),lambda a:a[4].update(creationAcknowledged=False),lambda a:a[0]['cleanup'].update(connections=1),lambda a:a[0]['cleanup'].pop('adminClosed'),lambda a:a[0].update(retainedDatabase='retained'),lambda a:a[0].update(primaryPhases=['setup']),lambda a:a[0].update(roots=[{'state':'KEEP'}]),lambda a:a[0].update(databaseLogicalBytes=64*1024*1024+1),lambda a:a[0].update(httpRequests=257),lambda a:a[0].update(cleanupComplete='true')]
  for mutate in mutations:
   with self.subTest(mutation=mutate):
    a=copy.deepcopy(valid());mutate(a);confirmed=False
    with self.assertRaises(ValueError):gate.confirm_fixture(*a,'w','h',9);confirmed=True
    helper=types.SimpleNamespace(temp_sample=lambda *_:self.fail('Unconfirmed receipt sampled root'))
    with patch.object(gate.shutil,'rmtree',side_effect=AssertionError('Unconfirmed deletion')):gate.cleanup_tmp(object(),(1,2),True,confirmed,0,helper,{'state':'KEEP'})
 def test_sample_cannot_start_without_common_deadline_reserve(self):
  helper=types.SimpleNamespace(temp_sample=lambda *_:self.fail('late sample started'))
  with patch.object(gate.time,'monotonic',return_value=86),self.assertRaisesRegex(ValueError,'TEMP_SAMPLE_NOT_STARTED_DEADLINE'):gate.cleanup_tmp(object(),(1,2),True,True,0,helper,{'state':'KEEP'})
 def test_sample_consuming_remaining_time_prevents_delete(self):
  helper=types.SimpleNamespace(temp_sample=lambda *_:{'logicalBytes':7,'entries':1});facts={'state':'KEEP'}
  with patch.object(gate.time,'monotonic',side_effect=[85,87]),patch.object(gate.shutil,'rmtree',side_effect=AssertionError('late delete')),self.assertRaisesRegex(ValueError,'TEMP_DELETE_NOT_STARTED_DEADLINE'):gate.cleanup_tmp(object(),(1,2),True,True,0,helper,facts)
  self.assertEqual(facts['state'],'KEEP')
 def test_identity_check_consuming_reserve_prevents_delete(self):
  helper=types.SimpleNamespace(temp_sample=lambda *_:{'logicalBytes':0});root=types.SimpleNamespace(lstat=lambda:types.SimpleNamespace(st_mode=0o40700,st_dev=1,st_ino=2))
  with patch.object(gate.time,'monotonic',side_effect=[80,81,87]),patch.object(gate.shutil,'rmtree',side_effect=AssertionError('late delete')),self.assertRaisesRegex(ValueError,'TEMP_DELETE_NOT_STARTED_DEADLINE'):gate.cleanup_tmp(root,(1,2),True,True,0,helper,{'state':'KEEP'})
 def test_receipt_and_final_persistence_share_same_origin(self):
  with patch.object(gate.time,'monotonic',return_value=85),self.assertRaisesRegex(ValueError,'RECEIPT_READ_NOT_STARTED_DEADLINE'):gate.require_phase(0,'RECEIPT_READ',5)
  with patch.object(gate.time,'monotonic',return_value=89),self.assertRaisesRegex(ValueError,'FINAL_RECEIPT_NOT_STARTED_DEADLINE'):gate.require_phase(0,'FINAL_RECEIPT',1)
 def test_known_closed_matching_root_can_be_removed_with_reserve(self):
  def missing():raise FileNotFoundError()
  root=types.SimpleNamespace(lstat=unittest.mock.Mock(side_effect=[types.SimpleNamespace(st_mode=0o40700,st_dev=1,st_ino=2),FileNotFoundError()]))
  helper=types.SimpleNamespace(temp_sample=lambda *_:{'logicalBytes':0});facts={'state':'KEEP'}
  with patch.object(gate.time,'monotonic',return_value=80),patch.object(gate.shutil,'rmtree')as remove:gate.cleanup_tmp(root,(1,2),True,True,0,helper,facts);remove.assert_called_once_with(root)
  self.assertEqual(facts['state'],'absent')

class ResultSelection(unittest.TestCase):
 def actual(self):
  return json.loads(pathlib.Path(__file__).with_name('pg-MATURE06-LAZY01-CLIENT-PG-20261007-R1.vitest.json').read_text())
 def assertions(self,result):return result['testResults'][0]['assertionResults']
 def test_actual_skipped_shape_exposes_old_error_and_new_exact_selection(self):
  result=self.actual();assertions=self.assertions(result)
  self.assertEqual([case['status']for case in assertions],['skipped','skipped','passed'])
  self.assertEqual(len([case for case in assertions if case['status']!='pending']),3)
  self.assertEqual(gate.validate_test_results(result,True),{'total':3,'passed':1,'failed':0,'pending':2,'selected':1,'unselected':2})
 def test_selected_failure_is_rejected(self):
  result=self.actual();self.assertions(result)[2]['status']='failed'
  result.update(success=False,numPassedTests=0,numFailedTests=1)
  with self.assertRaisesRegex(ValueError,'VALIDATION_NOT_PASSED'):gate.validate_test_results(result,True)
 def test_unknown_status_is_rejected(self):
  result=self.actual();self.assertions(result)[0]['status']='unknown'
  with self.assertRaisesRegex(ValueError,'TEST_STATUS_UNKNOWN'):gate.validate_test_results(result,True)
 def test_extra_execution_and_wrong_title_are_rejected(self):
  result=self.actual();self.assertions(result)[0]['status']='passed';result.update(numPassedTests=2,numPendingTests=1)
  with self.assertRaisesRegex(ValueError,'VALIDATION_NOT_PASSED'):gate.validate_test_results(result,True)
  result=self.actual();self.assertions(result)[2]['title']='unexpected execution'
  with self.assertRaisesRegex(ValueError,'TEST_SELECTION_MISMATCH'):gate.validate_test_results(result,True)

if __name__=='__main__':unittest.main()
