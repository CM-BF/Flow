"""One bounded SVC06 local iteration record; selected direct checks, never PG or host start."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
sys.dont_write_bytecode = True
base = Path(__file__).resolve().parent
root = base.parents[3]
node = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
shared = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(shared.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('svc06_diagnostics_ops14', shared)
module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
commands = {
 'core': [node, '--test', '--test-concurrency=1', 'tools/personal-preview/startup-diagnostics.test.mjs', 'tools/personal-preview/process.test.mjs'],
 'host': [node, '--test', '--test-concurrency=1', '--test-name-pattern=SVC06 changed startup diagnostics|SVC09 configured host uses actual|SVC09 old independently selected|SVC09 maintenance qualification', 'tools/personal-preview/preview.test.mjs'],
 'syntax': [node, '--check', 'tools/personal-preview/preview.mjs'],
 'status': [node, '--input-type=module', '-e', "import{readFile}from'node:fs/promises';import{parseStatus}from'/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/status.mjs';const s=parseStatus(await readFile('plans/svc06-backend-release/status.md','utf8'),'SVC06');console.log(JSON.stringify({errors:s.errors,humanMissing:s.human.missing,timingIssues:s.timing.issues}));if(s.errors.length||s.human.missing.length)process.exitCode=1;"],
}
name = sys.argv[1]; assert name in commands
record_path = base / 'local-runs.json'
record = json.loads(record_path.read_text()) if record_path.exists() else {'budget': {'processMs': 180000, 'scratchBytes': 16*1024**2, 'rawBytes': 2*1024**2}, 'runs': []}
used_ms = sum(item['report']['elapsed_ms'] for item in record['runs']); used_bytes = sum(item['report']['retained_bytes'] for item in record['runs'])
assert used_ms < 150000 and used_bytes < 2*1024**2 - 131072
free = os.statvfs(root); available = free.f_bavail * free.f_frsize
assert available >= int(2.5*1024**3) + 18*1024**2
scratch = Path(tempfile.mkdtemp(prefix='flow-svc06-diagnostics-local-')).resolve(); os.chmod(scratch, 0o700)
info = scratch.stat(); run = {'selection': name, 'startedAt': datetime.now(timezone.utc).isoformat(), 'freshFree': available, 'source': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(), 'scratch': str(scratch), 'scratchIdentity': {'dev': info.st_dev, 'ino': info.st_ino}, 'sourceFiles': []}
for path in ['tools/personal-preview/preview.mjs', 'tools/personal-preview/preview.test.mjs', 'tools/personal-preview/process.mjs', 'tools/personal-preview/process.test.mjs', 'tools/personal-preview/startup-diagnostics.mjs', 'tools/personal-preview/startup-diagnostics.test.mjs']:
    data = (root/path).read_bytes(); run['sourceFiles'].append({'path': path, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
env = {'PATH': str(Path(node).parent)+':/usr/bin:/bin', 'HOME': str(scratch), 'TMPDIR': str(scratch), 'TSX_DISABLE_CACHE': '1', 'NODE_DISABLE_COMPILE_CACHE': '1', 'PYTHONDONTWRITEBYTECODE': '1'}
report = module.supervise(module.Launch(tuple(commands[name]), str(root), env, module.Ownership.NEW_CHILD_SESSION), module.Policy(27, .5, 2, 131072))
run['report'] = dict(vars(report))
for stream in ('stdout', 'stderr'):
    data = getattr(report, stream); path = base/f'run-{len(record["runs"])+1:02}-{name}.{stream}'
    with path.open('xb') as file: file.write(data)
    run['report'][stream] = {'path': str(path.relative_to(root)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
current = scratch.stat(); assert (current.st_dev, current.st_ino) == (info.st_dev, info.st_ino)
entries = list(scratch.iterdir()); run['scratchEntriesAfter'] = len(entries)
# Only an empty exact owned scratch is removed; test cleanup owns its named children.
run['scratchRemoved'] = False
if not entries: scratch.rmdir(); run['scratchRemoved'] = True
run['finishedAt'] = datetime.now(timezone.utc).isoformat(); record['runs'].append(run)
record['processMs'] = used_ms + report.elapsed_ms; record['rawBytes'] = used_bytes + report.retained_bytes
record_path.write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps({'selection': name, 'exit': report.exit_code, 'elapsedMs': report.elapsed_ms, 'ownedState': report.owned_state, 'eof': report.eof, 'firstFailure': report.first_failure, 'scratchRemoved': run['scratchRemoved'], 'processMs': record['processMs']}))
raise SystemExit(0 if report.exit_code == 0 and report.first_failure is None and report.owned_state == 'absent' and all(report.eof.values()) and run['scratchRemoved'] else 1)
