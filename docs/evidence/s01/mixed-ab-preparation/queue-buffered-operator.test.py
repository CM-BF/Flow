"""Synthetic caller contract tests: no supervisor/PG/real environment or filesystem writes."""
import copy
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('buffered_caller', Path(__file__).with_name('queue-buffered-operator.py'))
caller = importlib.util.module_from_spec(spec); spec.loader.exec_module(caller)
TARGET = 'a' * 40

def result():
    return {'windowId': caller.WINDOW, 'target': TARGET, 'success': True, 'errors': [],
            'cleanup': {'removed': True, 'retained': False}, 'tasksSentOrUnknown': 129,
            'outcomes': [{'side': 'A', 'state': 'PASS', 'receipt': {'success': True, 'resourcesClosed': True, 'tasksSentOrUnknown': 129}}]}

class VariantTests(unittest.TestCase):
    def test_one_complete_outcome_only(self):
        self.assertTrue(caller.confirmed(result(), TARGET))
        for change in [{'outcomes': []}, {'outcomes': result()['outcomes'] * 2}, {'success': False}, {'errors': ['unknown']},
                       {'cleanup': {'removed': True, 'retained': True}}, {'target': 'b'*40}, {'windowId': caller.helper.WINDOW},
                       {'tasksSentOrUnknown': 128}]:
            self.assertFalse(caller.confirmed({**result(), **change}, TARGET))
        for receipt in [{}, {'success': True, 'resourcesClosed': True}, {'success': False, 'resourcesClosed': True, 'tasksSentOrUnknown':129},
                        {'success': True, 'resourcesClosed': False, 'tasksSentOrUnknown':129}]:
            value = result(); value['outcomes'][0]['receipt'] = receipt
            self.assertFalse(caller.confirmed(value, TARGET))
        for field, value in [('state','FAIL'), ('state','UNKNOWN'), ('side','B')]:
            body=result();body['outcomes'][0][field]=value;self.assertFalse(caller.confirmed(body,TARGET))

    def test_named_open_does_not_reuse_old_window_or_forward_poison(self):
        admin='postgresql://synthetic@localhost/synthetic'
        env=caller.authorized({'FLOW_S01_QUEUE_OPEN':caller.WINDOW,'FLOW_S01_ADMIN_URL':admin,'NODE_OPTIONS':'bad','PGHOST':'bad'})
        self.assertEqual(env,caller.helper.runtime_environment(admin));self.assertNotIn('FLOW_S01_QUEUE_OPEN',env)
        self.assertEqual(caller.helper.WINDOW,'s01-pool-wait-delivery-once')
        with self.assertRaises(ValueError):caller.authorized({'FLOW_S01_QUEUE_OPEN':caller.helper.WINDOW,'FLOW_S01_ADMIN_URL':admin})
        with self.assertRaises(ValueError):caller.helper.authorized_environment({'FLOW_S01_QUEUE_OPEN':caller.WINDOW,'FLOW_S01_ADMIN_URL':admin})

    def test_supervised_checkpoint_execs_only_fixed_entry_with_private_allowlist(self):
        with patch.object(caller.helper,'save') as save, patch.object(caller.os,'execve') as execute, \
             patch.object(caller.os,'environ',{'FLOW_S01_ADMIN_URL':'synthetic','NODE_OPTIONS':'bad'}):
            caller.child(TARGET,'17537695744')
        self.assertEqual(save.call_args.args[0].name,caller.NAMES[1])
        args=execute.call_args.args;self.assertEqual(args[1],[caller.helper.NODE,'--import','tsx',caller.ENTRY,caller.WINDOW,TARGET,'17537695744'])
        self.assertNotIn('NODE_OPTIONS',args[2]);self.assertNotIn('FLOW_S01_QUEUE_OPEN',args[2])

    def test_unknown_process_or_capture_cannot_confirm_resources(self):
        good=SimpleNamespace(exit_code=0,owned_state='absent',capture='separate',eof={'stdout':True,'stderr':True},first_failure=None,
            secondary_failures=[],signals=[],observed_bytes=2,retained_bytes=2,stdout=b'a',stderr=b'b')
        self.assertTrue(caller.process_closed(good))
        for change in [{'exit_code':1},{'owned_state':'unknown'},{'eof':{'stdout':True}}, {'first_failure':{'code':'SIGNAL_UNKNOWN'}},
                       {'signals':[{'state':'unknown'}]}, {'secondary_failures':['unknown']},{'retained_bytes':1}]:
            bad=copy.copy(good);bad.__dict__.update(change);self.assertFalse(caller.process_closed(bad))

    def test_cli_late_delivery_is_failure(self):
        clock=[caller.STARTED+299]
        def late(*args,**kwargs):
            self.assertTrue(kwargs['flush']);clock[0]=caller.STARTED+301
        with patch.object(caller.time,'monotonic',side_effect=lambda:clock[0]), patch('builtins.print',side_effect=late):
            self.assertEqual(caller.emit_result({'automaticVerdict':'PASS'}),1)

if __name__=='__main__':unittest.main()
