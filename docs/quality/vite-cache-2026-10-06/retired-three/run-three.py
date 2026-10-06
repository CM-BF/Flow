"""Sequential exact-cache operations under the existing reviewed OPS14 supervisor."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

root = Path(__file__).resolve().parent
operator = root / 'cleanup-three.py'
module_path = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(operator.read_bytes()).hexdigest() == 'a7e0ba58b31fa2dea6685eff73d6c4335967fcc158e42ff4e5d018f65a4bdeef'
assert hashlib.sha256(module_path.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('ops14_three_caches', module_path)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
names = ('web-plugin-management-integration', 'web-profile-integration', 'web-steering-control')

def write_new(path, body):
    with path.open('xb') as stream:
        stream.write(body)
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    os.fsync(fd)
    os.close(fd)

def encoded(value):
    return (json.dumps(value, separators=(',', ':')) + '\n').encode()

summary = []
for index, name in enumerate(names):
    v = os.statvfs(root)
    free = v.f_bavail * v.f_frsize
    reservation = {'atUnix': time.time(), 'name': name, 'index': index, 'freeBytes': free,
                   'resourceRecoveryOnlyMinimumBytes': 33554432, 'policy': [45, .5, 2, 16384],
                   'operatorSha256': hashlib.sha256(operator.read_bytes()).hexdigest()}
    write_new(root / f'{name}-supervisor-reservation.json', encoded(reservation))
    if free >= 1241513984 or free < 33554432:
        summary.append({'name': name, 'state': 'NOT_RUN_SPACE_BOUND', 'freeBytes': free})
        break
    result = module.supervise(module.Launch(
        (sys.executable, '-B', str(operator), str(index)), '/private/tmp',
        {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin:/usr/sbin', 'LC_ALL': 'C', 'GIT_OPTIONAL_LOCKS': '0', 'PYTHONDONTWRITEBYTECODE': '1'},
        module.Ownership.NEW_CHILD_SESSION), module.Policy(45, .5, 2, 16384))
    write_new(root / f'{name}.stdout', result.stdout)
    write_new(root / f'{name}.stderr', result.stderr)
    report = {k: v for k, v in vars(result).items() if k not in ('stdout', 'stderr')}
    report['stdoutSha256'] = hashlib.sha256(result.stdout).hexdigest()
    report['stderrSha256'] = hashlib.sha256(result.stderr).hexdigest()
    write_new(root / f'{name}-supervision.json', encoded(report))
    action_path = root / f'{name}-cleanup.json'
    action = json.loads(action_path.read_text()) if action_path.is_file() else None
    summary.append({'name': name, 'supervision': report, 'action': action})
    if result.exit_code != 0 or result.owned_state != 'absent' or result.first_failure or not action or action['state'] not in ('COMPLETE', 'NOT_RUN_PREPARE_MARGIN_REACHED'):
        break
write_new(root / 'three-operation-summary.json', encoded({'atUnix': time.time(), 'operations': summary, 'noFurtherCandidateAuthorized': True}))
print(json.dumps([{'name': s['name'], 'state': s.get('action', {}).get('state') if s.get('action') else s.get('state'), 'elapsedMs': s.get('supervision', {}).get('elapsed_ms')} for s in summary]))
