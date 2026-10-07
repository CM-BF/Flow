"""Same-window caller behavior with fake supervision; no Node/PG/HTTP children."""
from pathlib import Path
import importlib.util,sys,os,json,tempfile,unittest
from types import SimpleNamespace
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('k01_postflight_entry',Path(__file__).with_name('entry.py'))
entry=importlib.util.module_from_spec(spec);spec.loader.exec_module(entry)
spec=importlib.util.spec_from_file_location('k01_postflight_ops',entry.SUPERVISOR)
ops=importlib.util.module_from_spec(spec);sys.modules[spec.name]=ops;spec.loader.exec_module(ops)
class PostflightTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']);self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.folder=self.root/'record';self.folder.mkdir()
        self.tmp,self.identity=entry.create_scratch(self.root)
        self.context={'window':'synthetic-window','sourceHead':'fixed-source','permitSha256':'fixed-permit','namespace':self.identity}
        entry.write_new(self.tmp/'primary-context.json',self.context)
        self.expected={'database':'flow_k01_query_'+'a'*32,'identity':{'oid':'42','owner':'synthetic','marker':'12345678-1234-1234-1234-123456789abc'}}
        entry.write_new(self.tmp/'owned.database-reservation.json',{'database':self.expected['database'],**{k:self.expected['identity'][k] for k in ('owner','marker')},'createdAt':'synthetic'})
        entry.write_new(self.tmp/'owned.create-ack.json',{'database':self.expected['database'],'creationAcknowledged':True})
        entry.write_new(self.tmp/'owned.database-identity.json',self.expected)
        (self.root/'owned-db-observation.mjs').write_text('// synthetic fixed input')
        self.primary=ops.Report(exit_code=-15,owned_state='absent',capture='merged',eof={'stdout':True},first_failure={'code':'DEADLINE_EXCEEDED'},secondary_failures=[{'code':'CHILD_EXIT_NONZERO'}],signals=[{'state':'sent'}])
        self.calls=0;self.now=10;self.spawnFailure=False
        self.observation={'state':'ZERO_CONNECTIONS_SNAPSHOT','rows':[{'name':self.expected['database'],**self.expected['identity'],'connections':0}], 'identityMatched':True,'closed':True,'firstError':None,'closeError':None}
        self.module=SimpleNamespace(Launch=ops.Launch,Policy=ops.Policy,Ownership=ops.Ownership,Capture=ops.Capture,supervise=self.probe)
    def probe(self,launch,policy):
        self.calls+=1;self.assertLessEqual(policy.work_seconds+policy.term_grace_seconds+policy.kill_grace_seconds,10)
        self.assertEqual(set(launch.env),{'PATH','FLOW_K01_QUERY_ADMIN_URL','K01_EXPECTED_IDENTITY'})
        if self.spawnFailure:raise OSError(1,'synthetic spawn')
        raw=json.dumps(self.observation).encode()
        return ops.Report(exit_code=0,owned_state='absent',capture='merged',eof={'stdout':True},stdout=raw,observed_bytes=len(raw),retained_bytes=len(raw))
    def run_postflight(self):
        return entry.pg_postflight(self.module,self.root,self.folder,self.tmp,self.identity,self.context,self.primary,b'',0,
          {'PATH':'synthetic','FLOW_K01_QUERY_ADMIN_URL':'synthetic-private','HOME':'excluded'},clock=lambda:self.now)
    def test_absolute_deadlines_do_not_reset_after_preflight_or_early_return(self):
        self.assertEqual([entry.phase_budget(100,105,p) for p in ['work','cleanup','child-result','primary-stop','observer','parent-receipt']],[65,105,115,125,135,145])
        self.assertEqual(entry.phase_budget(100,251,'parent-receipt'),0)
    def test_known_timeout_can_observe_once_without_turning_measurement_green(self):
        original=entry.dataclasses.asdict(self.primary);result=self.run_postflight()
        self.assertEqual(result['state'],'OBSERVED');self.assertEqual(result['measurementOutcome'],'FAIL')
        self.assertEqual(result['database'],'KEEP_ZERO_CONNECTIONS_SNAPSHOT');self.assertEqual(self.calls,1)
        self.assertEqual(entry.dataclasses.asdict(self.primary),original)
        self.assertEqual(self.run_postflight()['state'],'SKIPPED_UNKNOWN');self.assertEqual(self.calls,1)
    def test_unknown_process_or_capture_never_reads_identity_or_spawns(self):
        for field,value in [('owned_state','unknown'),('eof',{}),('signals',[{'state':'unknown'}]),('secondary_failures',[{'code':'CAPTURE_CLOSE_FAILED'}])]:
            before=getattr(self.primary,field);setattr(self.primary,field,value)
            with patch.object(entry,'owned_database_input',side_effect=AssertionError('not allowed')):self.assertEqual(self.run_postflight()['state'],'SKIPPED_UNKNOWN')
            setattr(self.primary,field,before)
        self.assertEqual(self.calls,0)
    def test_missing_or_changed_identity_prevents_probe(self):
        p=self.tmp/'owned.create-ack.json';p.unlink();self.assertEqual(self.run_postflight()['state'],'SKIPPED_UNKNOWN')
        entry.write_new(p,{'database':self.expected['database'],'creationAcknowledged':False})
        self.assertEqual(self.run_postflight()['state'],'SKIPPED_UNKNOWN');self.assertEqual(self.calls,0)
    def test_identity_reads_reject_hardlinks_and_bind_exact_bytes(self):
        known,bindings=entry.owned_database_input(self.tmp,self.identity,self.context);self.assertEqual(known,self.expected)
        self.assertEqual(len(bindings),3);self.assertTrue(all(b['bytes']>0 and len(b['sha256'])==64 for b in bindings))
        p=self.tmp/'owned.database-identity.json';os.link(p,self.root/'hardlink')
        with self.assertRaises(ValueError):entry.owned_database_input(self.tmp,self.identity,self.context)
    def test_time_or_storage_reserve_prevents_probe_without_extending_deadline(self):
        self.now=131;self.assertEqual(self.run_postflight()['state'],'SKIPPED_UNKNOWN')
        self.now=10
        with patch.object(entry,'logical_bytes',return_value=8*1024*1024):self.assertEqual(self.run_postflight()['state'],'SKIPPED_UNKNOWN')
        self.assertEqual(self.calls,0);self.assertFalse((self.folder/'db-observer-intent.json').exists())
    def test_spawn_failure_consumes_intent_without_retry(self):
        self.spawnFailure=True;self.assertTrue(self.run_postflight()['observerAttempted']);self.assertEqual(self.calls,1)
        self.spawnFailure=False;self.assertEqual(self.run_postflight()['state'],'SKIPPED_UNKNOWN');self.assertEqual(self.calls,1)
    def test_closed_child_cleanup_skips_duplicate_observation(self):
        cleanup={'database':self.expected['database'],'identity':self.expected['identity'],'absent':True,'errors':[]}
        cleanup.update({k:True for k in ['adminClosed','appClosed','auxiliaryClosed','startupSettled','moduleLoadSettled','listenSettled']})
        entry.write_new(self.tmp/'result.json',{'window':self.context['window'],'passed':False,'cleanup':cleanup})
        result=self.run_postflight();self.assertEqual(result['state'],'CHILD_CLEANUP_CONFIRMED');self.assertEqual(result['measurementOutcome'],'FAIL');self.assertEqual(self.calls,0)
    def test_observer_identity_mismatch_cannot_claim_database_return(self):
        self.observation['rows'][0]['oid']='43';result=self.run_postflight();self.assertEqual(result['database'],'KEEP_UNKNOWN')
        self.assertEqual(result['measurementOutcome'],'FAIL')
    def test_empty_observer_capture_is_unknown_and_preserves_primary_failure(self):
        self.module.supervise=lambda launch,policy:ops.Report(exit_code=0,owned_state='absent',capture='merged',eof={'stdout':True})
        result=self.run_postflight();self.assertEqual(result['database'],'KEEP_UNKNOWN');self.assertEqual(result['measurementOutcome'],'FAIL')
        self.assertEqual(result['observerRawSha256'],entry.hashlib.sha256(b'').hexdigest());self.assertIn('failure',result)
    def test_flush_crossing_deadline_fails_final_return(self):
        now=[149]
        def flush(value):now[0]=151
        self.assertFalse(entry.emit_return({'passed':True},150,clock=lambda:now[0],emit=flush))
if __name__=='__main__':unittest.main()
