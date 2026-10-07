"""One bounded local validation segment; no PG, services, providers, or installation."""
import hashlib, importlib.util, json, os, sys
from pathlib import Path
sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
MODULE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('svc06_boundary_supervision', MODULE)
supervision = importlib.util.module_from_spec(spec); sys.modules[spec.name] = supervision; spec.loader.exec_module(supervision)
name = sys.argv[1]
assert name in ('local-01', 'local-02', 'local-03')
free = os.statvfs('/private/tmp'); available = free.f_bavail * free.f_frsize
assert available >= 1024**3 + 8 * 1024**2
fd = os.open(BASE / (name + '-outer.json'), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
node = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
argv = [node, '--test', '--test-concurrency=1']
if len(sys.argv) == 3:
    argv += ['--test-name-pattern=' + sys.argv[2]]
argv.append(str(BASE / 'boundary.test.mjs'))
report = supervision.supervise(supervision.Launch(tuple(argv), str(BASE), {'PATH': str(Path(node).parent) + ':/usr/bin:/bin:/usr/sbin', 'TSX_DISABLE_CACHE': '1'}, supervision.Ownership.NEW_CHILD_SESSION), supervision.Policy(27, .5, 2, 32768))
result = dict(vars(report))
for field in ('stdout', 'stderr'):
    result[field] = getattr(report, field).decode('utf8', 'replace')
result['freeBefore'] = available
with os.fdopen(fd, 'w') as stream:
    json.dump(result, stream); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
print(json.dumps({'exit': report.exit_code, 'elapsedMs': report.elapsed_ms, 'owned': report.owned_state, 'eof': report.eof, 'failure': report.first_failure}))
raise SystemExit(0 if report.exit_code == 0 and report.owned_state == 'absent' and not report.first_failure and all(report.eof.values()) else 1)
