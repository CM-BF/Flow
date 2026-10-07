"""Fixed OPS14 deadline around all install entry reads, fsyncs and final checks.

Only a bounded stdout report follows the stop decision; it is not a persistence
precondition. An interrupted entry/reservation remains unknown and is not retried.
"""
import importlib.util
import json
import os
from pathlib import Path
import sys

MODULE = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py'
PYTHON = '/opt/homebrew/opt/python@3.13/bin/python3.13'
spec = importlib.util.spec_from_file_location('svc06_outer_ops14', MODULE)
supervision = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = supervision
spec.loader.exec_module(supervision)
entry = Path(__file__).resolve().with_name('parser-install.py')
report = supervision.supervise(
    supervision.Launch((PYTHON, str(entry), '--entry'), str(entry.parents[3]),
                       {'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'}, supervision.Ownership.NEW_CHILD_SESSION),
    supervision.Policy(27, 0.5, 2, 16384))
result = dict(vars(report))
result['stdout'] = report.stdout.decode('utf8', 'replace')
result['stderr'] = report.stderr.decode('utf8', 'replace')
print(json.dumps(result), flush=True)
raise SystemExit(0 if report.exit_code == 0 and not report.first_failure and report.owned_state == 'absent' and all(report.eof.values()) else 1)
