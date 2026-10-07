"""Fixed one-session artifact build; no detached runtime/service processes are started."""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
sys.dont_write_bytecode = True
MODULE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('svc06_artifact_ops14', MODULE)
supervision = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = supervision
spec.loader.exec_module(supervision)
entry = Path(__file__).resolve().with_name('entry.mjs')
report = supervision.supervise(
    supervision.Launch(('/opt/homebrew/opt/node@24/bin/node', str(entry)), str(entry.parents[4]),
        {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}, supervision.Ownership.NEW_CHILD_SESSION),
    supervision.Policy(420, .5, 2, 1024 * 1024))
result = dict(vars(report))
for key in ('stdout', 'stderr'):
    result[key] = getattr(report, key).decode('utf8', 'replace')
print(json.dumps(result), flush=True)
raise SystemExit(0 if report.exit_code == 0 and not report.first_failure and report.owned_state == 'absent' and all(report.eof.values()) else 1)
