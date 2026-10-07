"""Only in-memory recipe/closure qualification; no fixture creation or process launch."""
import copy, importlib.util, json, pathlib, sys, unittest
sys.dont_write_bytecode = True
here = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('x01_center_pg', here / 'center-claim-pg-once.py')
caller = importlib.util.module_from_spec(spec); spec.loader.exec_module(caller)

class SingleSuiteRecipe(unittest.TestCase):
    def test_fixed_selection_and_budget(self):
        limits = json.loads((here / 'center-claim-pg-input.json').read_text())
        self.assertEqual(len(limits['selection']), 6)
        self.assertEqual(len(set(x['name'] for x in limits['selection'])), 6)
        self.assertEqual(list(limits['suites']), ['runtime'])
        self.assertEqual(limits['suites']['runtime']['httpRequests'], 256)
        self.assertEqual(limits['workSeconds'] + limits['cleanupSeconds'] + limits['finalReserveSeconds'], 180)
        self.assertEqual(limits['reserveBytes'] + limits['temporaryBytes'] + limits['rawBytes'] + limits['databaseReserveBytes'], 1242562560)
    def test_single_actual_listener_and_marked_database_are_required(self):
        common = dict(window='a'*32, sourceHead='b'*40, suite='runtime', database='flow_x01_'+'c'*32)
        identity = dict(oid='123', owner='flow', marker='x01:owned')
        cleanup = {k: True for k in ['ownersClosed','poolClosed','adminClosed','createRequested','createAcknowledged','creationReceiptSaved','identityConfirmed','dropRequested','dropAcknowledged','databaseAbsent']}
        cleanup.update(owners=dict(startup=True,server=True,boss=True), identity=identity, connections=0)
        rows = {k: dict(common, **v) for k,v in dict(reservation={}, **{'create-request':dict(owner='flow',marker='x01:owned')}, created=dict(identity=identity), result=dict(cleanup=cleanup,cleanupConfirmed=True,retainedDatabase=None,errors=[],errorCount=0,listeners=[dict(origin='http://127.0.0.1:12345',closed=True)])).items()}
        self.assertTrue(caller.suite_confirmed('runtime', rows, 'a'*32, 'b'*40))
        for mutation in ['marker','listener','connection']:
            broken = copy.deepcopy(rows)
            if mutation=='marker': broken['create-request']['marker']='different'
            elif mutation=='listener': broken['result']['listeners'][0]['closed']=False
            else: broken['result']['cleanup']['connections']=1
            self.assertFalse(caller.suite_confirmed('runtime', broken, 'a'*32, 'b'*40))

if __name__ == '__main__': unittest.main(verbosity=2)
