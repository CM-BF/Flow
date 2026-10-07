"""Use OPS14 for the work owner and a separate cleanup owner; do not supervise service PIDs by guess."""
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
inputs = json.loads((BASE / 'inputs.json').read_text())
module = inputs['supervisor']
raw = Path(module['path']).read_bytes()
assert len(raw) == module['bytes'] and hashlib.sha256(raw).hexdigest() == module['sha256']
spec = importlib.util.spec_from_file_location('svc08_web_host_ops14', module['path'])
supervision = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = supervision
spec.loader.exec_module(supervision)
manifest = json.loads((BASE / 'manifest.json').read_text())
for item in manifest['entryBindings']:
    raw = (BASE / item['path']).read_bytes()
    assert len(raw) == item['bytes'] and hashlib.sha256(raw).hexdigest() == item['sha256']
fd = os.open(BASE / 'web-host-outer.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
node = inputs['node']
root = Path(inputs['sourceDirectory']) / 'backend-artifacts' / inputs['artifact']['artifactId'] / 'root'
env = {'PATH': f'{Path(node).parent}:/usr/bin:/bin:/usr/sbin', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1',
       'FLOW_SVC08_ADMIN_URL': os.environ.get('FLOW_SVC08_ADMIN_URL', '')}
reports, errors = {}, {}
try:
    reports['work'] = supervision.supervise(
        supervision.Launch((node, '--import', str(root / 'node_modules/tsx/dist/loader.mjs'), str(BASE / 'entry.mjs'), 'work'), str(root), env, supervision.Ownership.NEW_CHILD_SESSION),
        supervision.Policy(120, .5, 2, 128 * 1024))
except BaseException as error:
    errors['work'] = type(error).__name__
finally:
    try:
        reports['cleanup'] = supervision.supervise(
            supervision.Launch((node, '--import', str(root / 'node_modules/tsx/dist/loader.mjs'), str(BASE / 'entry.mjs'), 'cleanup'), str(root), env, supervision.Ownership.NEW_CHILD_SESSION),
            supervision.Policy(30, .5, 2, 128 * 1024))
    except BaseException as error:
        errors['cleanup'] = type(error).__name__
result = {'supervisionErrors': errors}
for name, report in reports.items():
    value = dict(vars(report))
    for key in ('stdout', 'stderr'):
        value[key] = getattr(report, key).decode('utf8', 'replace')
    result[name] = value
# Both supervised owners have stopped/reaped before this persistence. The Web group is separately proven by cleanup.
with os.fdopen(fd, 'w', encoding='utf8') as stream:
    json.dump(result, stream, ensure_ascii=False); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
parent = os.open(str(BASE), os.O_RDONLY)
try:
    os.fsync(parent)
finally:
    os.close(parent)
print(json.dumps({name: {'exit': r.exit_code, 'owned': r.owned_state, 'eof': r.eof, 'failure': r.first_failure, 'elapsedMs': r.elapsed_ms} for name, r in reports.items()}), flush=True)
raise SystemExit(0 if not errors and len(reports) == 2 and all(r.exit_code == 0 and not r.first_failure and r.owned_state == 'absent' and all(r.eof.values()) for r in reports.values()) else 1)
