"""One work owner plus an independent bounded cleanup owner for the three recorded service groups."""
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
MODULE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('svc06_b2b_host_ops14', MODULE)
supervision = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = supervision
spec.loader.exec_module(supervision)
inputs = json.loads((BASE / 'inputs.json').read_text())
for item in inputs['runtimeReadonly']:
    path = Path(item['path']); info = path.lstat()
    assert not path.is_symlink() and path.is_file() and str(path.resolve()) == item['realpath']
    assert (info.st_dev, info.st_ino, info.st_uid, info.st_nlink, info.st_size) == (item['dev'], item['ino'], item['uid'], item['nlink'], item['bytes'])
    assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
manifest = json.loads((BASE / 'entry-manifest.json').read_text())
for item in manifest['entryBindings']:
    raw = (BASE / item['path']).read_bytes()
    assert len(raw) == item['bytes'] and hashlib.sha256(raw).hexdigest() == item['sha256']
# Open once before launch; no success/unknown result can be re-run under the same destination.
fd = os.open(BASE / 'host-policy-outer.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
node = inputs['node']
root = Path(inputs['sourceDirectory']) / 'backend-artifacts' / inputs['artifact']['artifactId'] / 'root'
env = {'PATH': f'{Path(node).parent}:/usr/bin:/bin:/usr/sbin', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1',
       'FLOW_SVC06_ADMIN_URL': os.environ.get('FLOW_SVC06_ADMIN_URL', '')}
reports = {}
errors = {}
try:
    reports['work'] = supervision.supervise(
        supervision.Launch((node, str(BASE / 'entry.mjs'), 'launch'), str(root), env, supervision.Ownership.NEW_CHILD_SESSION),
        supervision.Policy(180, .5, 2, 128 * 1024))
except BaseException as error:
    errors['work'] = type(error).__name__
finally:
    # This owner remains outside the work session. Detached services are stopped only through their real recorded identities.
    # A failed/missing nonce or launch record stays unknown; no PID-only or process-name kill fallback exists.
    work = reports.get('work')
    terminal = {'format': 1, 'inputSha256': hashlib.sha256((BASE / 'inputs.json').read_bytes()).hexdigest(),
                'directory': inputs['directory'], 'runName': inputs['runName'],
                'pid': work.pid if work else None, 'ownership': work.ownership if work else None,
                'ownedState': work.owned_state if work else 'unknown', 'exitCode': work.exit_code if work else None,
                'eof': work.eof if work else {}, **({'supervisionError': errors['work']} if 'work' in errors else {})}
    cleanup_env = {**env, 'FLOW_SVC06_WORK_TERMINAL': json.dumps(terminal)}
    try:
        reports['cleanup'] = supervision.supervise(
            supervision.Launch((node, '--import', str(root / 'node_modules/tsx/dist/loader.mjs'), str(BASE / 'entry.mjs'), 'cleanup'), str(root), cleanup_env, supervision.Ownership.NEW_CHILD_SESSION),
            supervision.Policy(30, .5, 2, 128 * 1024))
    except BaseException as error:
        errors['cleanup'] = type(error).__name__
result = {'supervisionErrors': errors}
for name, report in reports.items():
    value = dict(vars(report))
    for key in ('stdout', 'stderr'):
        value[key] = getattr(report, key).decode('utf8', 'replace')
    result[name] = value
# Stopping/reaping both owners completes before output persistence. Service-group evidence is separate in cleanup.
with os.fdopen(fd, 'w', encoding='utf8') as stream:
    json.dump(result, stream, ensure_ascii=False); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
parent = os.open(str(BASE), os.O_RDONLY)
try:
    os.fsync(parent)
finally:
    os.close(parent)
summary = {name: {'exit': r.exit_code, 'owned': r.owned_state, 'eof': r.eof, 'failure': r.first_failure, 'elapsedMs': r.elapsed_ms} for name, r in reports.items()}
print(json.dumps(summary), flush=True)
raise SystemExit(0 if not errors and len(reports) == 2 and all(r.exit_code == 0 and not r.first_failure and r.owned_state == 'absent' and all(r.eof.values()) for r in reports.values()) else 1)
