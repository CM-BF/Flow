"""Fixed one-session artifact build; no detached runtime/service processes are started."""
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
sys.dont_write_bytecode = True
MODULE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('svc06_diagnostics_ops14', MODULE)
supervision = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = supervision
spec.loader.exec_module(supervision)
entry = Path(__file__).resolve().with_name('entry.mjs')
# Exclusive raw destination is opened before any child; no retry of an old reservation.
output = entry.with_name('outer-report.json')
fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
report = supervision.supervise(
    supervision.Launch(('/opt/homebrew/opt/node@24/bin/node', str(entry)), str(entry.parents[5]),
        {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}, supervision.Ownership.NEW_CHILD_SESSION),
    supervision.Policy(420, .5, 2, 1024 * 1024))
result = dict(vars(report))
for key in ('stdout', 'stderr'):
    result[key] = getattr(report, key).decode('utf8', 'replace')
# Child/group stop decisions have finished before persistence; a blocked fsync cannot defer stopping.
with os.fdopen(fd, 'w', encoding='utf8') as stream:
    json.dump(result, stream, ensure_ascii=False)
    stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
parent = os.open(str(output.parent), os.O_RDONLY)
try:
    os.fsync(parent)
finally:
    os.close(parent)
print(json.dumps({'raw': str(output), 'exit_code': report.exit_code, 'owned_state': report.owned_state, 'eof': report.eof, 'first_failure': report.first_failure, 'elapsed_ms': report.elapsed_ms}), flush=True)
raise SystemExit(0 if report.exit_code == 0 and not report.first_failure and report.owned_state == 'absent' and all(report.eof.values()) else 1)
