"""Only R4's new source-path seam and real prelaunch consumer; no journey child."""
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('tui_r4', Path(__file__).with_name('r4-run.py'))
entry = importlib.util.module_from_spec(spec); spec.loader.exec_module(entry)
caller, run = entry.caller, entry.R4
class BoundaryReached(Exception): pass

class R4Boundary(unittest.TestCase):
    def test_actual_r4_source_identity_and_supervision_boundary(self):
        fixed, digest, count = caller.verify_inputs(run)
        self.assertEqual(count, 741); self.assertEqual(len(fixed['own']), 8)
        text = (caller.ROOT/'experiments/tui-web-control-handoff/journey.ts').read_text()
        literal = re.search(r'const OWN = \[(.*?)\];', text, re.S).group(1)
        self.assertEqual(tuple(re.findall(r"'([^']+)'", literal)), run.source_paths)
        self.assertEqual(caller.R2.source_paths, tuple(caller.OWN))
        self.assertNotIn('apps/tui/src/task-controls/fixture-process.ts', caller.R2.source_paths)
        with self.assertRaisesRegex(AssertionError, 'SOURCE_DIGEST'):
            caller.verify_inputs(run._replace(source_paths=caller.R2.source_paths))
        with self.assertRaisesRegex(AssertionError, 'EXACT_ARGUMENT'): entry.main(['--run-r3-once'])
        pending=json.loads(Path(__file__).with_name('r4-permit.pending.json').read_text())
        self.assertFalse(pending['ready']); self.assertEqual(pending['inputDigest'], digest)
        now=datetime.now(timezone.utc)
        permit={**pending,'ready':True,'startBefore':(now+timedelta(seconds=20)).isoformat(),
            'freshObservedAt':now.isoformat(),'pgAvailable':42,'preflightPoolClosed':True,
            'minimumFreshFreeBytes':2**30+128*1024**2,'actualHolder':None}
        with tempfile.TemporaryDirectory(prefix='tui-r4-entry-',dir=os.environ['TMPDIR']) as tmp:
            root=Path(tmp)
            (root/run.input_name).write_bytes(Path(__file__).with_name(run.input_name).read_bytes())
            (root/run.permit_name).write_text(json.dumps(permit))
            ops=caller.load_ops(fixed['supervisor'])
            def stop(launch,policy):
                ops._validate(launch,policy)
                self.assertEqual(launch.argv,(fixed['node']['path'],'--import','tsx',
                    'experiments/tui-web-control-handoff/journey.ts','--run',str(root/run.permit_name)))
                self.assertEqual((policy.work_seconds,policy.term_grace_seconds,policy.kill_grace_seconds,policy.output_bytes),(150,.5,2,65536))
                saved=json.loads((root/run.outer_name/'reservation.json').read_text())
                self.assertEqual(saved['sourceDigest'],fixed['sourceDigest']); self.assertEqual(saved['window'],run.window)
                self.assertEqual((root/run.outer_name).stat().st_mode&0o777,0o700)
                self.assertEqual((root/run.outer_name/'reservation.json').stat().st_mode&0o777,0o600)
                raise BoundaryReached()
            with patch.object(caller,'HERE',root),patch.object(caller,'load_ops',return_value=ops),\
                 patch.object(ops,'supervise',side_effect=stop) as launch,\
                 patch.dict(os.environ,{'FLOW_TEST_DATABASE_URL':'postgresql://127.0.0.1/postgres'}):
                with self.assertRaises(BoundaryReached):entry.main(['--run-r4-once'])
                self.assertEqual(launch.call_count,1)
                with self.assertRaises(FileExistsError):entry.main(['--run-r4-once'])
                self.assertEqual(launch.call_count,1)
        for name in ['r4-permit.json','r4-actual-once','windows/'+run.window+'.json','captures/'+run.window]:
            self.assertFalse(os.path.lexists(Path(__file__).parent/name))

if __name__=='__main__':unittest.main()
