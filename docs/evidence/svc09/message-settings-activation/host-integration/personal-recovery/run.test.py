import importlib.util
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('held_recovery_test', HERE / 'run.py')
caller = importlib.util.module_from_spec(spec); spec.loader.exec_module(caller)

class Assembly(unittest.TestCase):
    def test_no_replay_and_actual_artifact_loader_switch(self):
        value = {'ready': True, 'purpose': 'SVC06B_SAME_HELD_OPERATION_RECOVERY', 'phases': caller.PHASES,
            'reports': [{}] * 4, 'publishNewWeb': False, 'providerQueries': 0,
            'operationId': '35d5a7ff-5ef7-4938-9584-adb27f5357ff', 'version': 23,
            'runDirectory': '/private/tmp/flow-svc06-held-recovery-test',
            'migration': {'installationDirectory': '/Users/citrine/.flow-personal',
                'expectedBackendArtifact': {'artifactId': 'old'}, 'artifact': {'artifactId': 'new'},
                'budget': {'freshBytes': 16635330560, 'liveBytes': 1073741824, 'rawBytes': 2097152}}}
        result = caller.compile_plan(value, '/private/tmp/fixed.json', 'a' * 64, 1)
        self.assertEqual([step['name'] for step in result['steps']], caller.PHASES)
        self.assertTrue(all(step['ownership'] == 'childPidOnly' for step in result['steps']))
        self.assertIn('/old/root/', result['steps'][3]['argv'][2])
        self.assertIn('/new/root/', result['steps'][4]['argv'][2])
        self.assertEqual(result['budget']['perPhaseOutputBytes'], 65536)
        value['ready'] = False
        with self.assertRaises(AssertionError): caller.compile_plan(value, '/private/tmp/fixed.json', 'a' * 64, 1)

if __name__ == '__main__': unittest.main()
