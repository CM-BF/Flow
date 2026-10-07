"""One trusted, bounded cleanup owner. Detached center is signalled only by the artifact helper."""
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
inputs = json.loads((BASE / 'cleanup-followup-inputs.json').read_text())
manifest = json.loads((BASE / 'cleanup-followup-manifest.json').read_text())
for item in manifest['entryBindings']:
    raw = (BASE / item['path']).read_bytes()
    assert len(raw) == item['bytes'] and hashlib.sha256(raw).hexdigest() == item['sha256']
module = Path(inputs['sharedSupervisor']['path'])
assert hashlib.sha256(module.read_bytes()).hexdigest() == inputs['sharedSupervisor']['sha256']
spec = importlib.util.spec_from_file_location('svc06_cleanup_ops14', module)
supervision = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = supervision
spec.loader.exec_module(supervision)
fd = os.open(BASE / 'cleanup-followup-outer.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
root = Path(inputs['directory']) / 'backend-artifacts' / inputs['artifact']['artifactId'] / 'root'
node = inputs['node']
env = {'PATH': f'{Path(node).parent}:/usr/bin:/bin:/usr/sbin', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}
report = None
result = {}
try:
    report = supervision.supervise(
        supervision.Launch((node, '--import', str(root / 'node_modules/tsx/dist/loader.mjs'), str(BASE / 'cleanup-followup.mjs')), str(root), env, supervision.Ownership.NEW_CHILD_SESSION),
        supervision.Policy(27, .5, 2, inputs['policy']['captureBytes']))
    result = dict(vars(report))
    for key in ('stdout', 'stderr'):
        result[key] = getattr(report, key).decode('utf8', 'replace')
except BaseException as error:
    result = {'supervisionErrorType': type(error).__name__}
# All stop/reap decisions finish before raw persistence. A failed write cannot delay signalling.
raw = (json.dumps(result, ensure_ascii=True) + '\n').encode()
assert len(raw) <= 128 * 1024
with os.fdopen(fd, 'wb') as stream:
    stream.write(raw); stream.flush(); os.fsync(stream.fileno())
parent = os.open(BASE, os.O_RDONLY)
try:
    os.fsync(parent)
finally:
    os.close(parent)
print(json.dumps({'exit': report.exit_code, 'owned': report.owned_state, 'eof': report.eof, 'failure': report.first_failure, 'elapsedMs': report.elapsed_ms}) if report else json.dumps(result), flush=True)
raise SystemExit(0 if report and report.exit_code == 0 and report.owned_state == 'absent' and all(report.eof.values()) and not report.first_failure else 1)
