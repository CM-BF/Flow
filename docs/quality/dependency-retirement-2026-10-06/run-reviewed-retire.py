"""One reviewed resource recovery action; no restore or retry."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parent
OPERATOR = ROOT / 'flow-workspace-cache-payload-operator.py'
MANIFEST = ROOT / 'flow-workspace-cache-qualified-payload.json.gz'
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
EXPECTED = 'f187f94794f7a725109655905255236559f1f56f6a11c510163973eb6cb19036'
assert hashlib.sha256(OPERATOR.read_bytes()).hexdigest() == EXPECTED
assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'

def durable_new(path, body):
    with path.open('xb') as stream:
        os.chmod(path, 0o600)
        stream.write(body)
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    os.fsync(fd)
    os.close(fd)

def encoded(value):
    return (json.dumps(value, separators=(',', ':')) + '\n').encode()

state = ROOT / 'actions'
run_id = uuid.uuid4().hex
permit = {'operatorSha256': EXPECTED,
          'manifestSha256': 'b5f39740a9f4db45a0b5793680834233d382235f1e4a663cc98f3a06a5dcd9b3',
          'candidateRoot': '/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-cache',
          'action': 'retire', 'cooperativeOwnerFreeze': True,
          'freshLedgerAndKernelReviewed': True, 'independentSupervisorRequired': True,
          'runId': run_id, 'startBeforeUnix': time.time() + 30, 'workSeconds': 120,
          'stateParentIdentity': [state.stat().st_dev, state.stat().st_ino]}
permit_path = ROOT / 'one-shot-retire-permit.json'
durable_new(permit_path, encoded(permit))  # exclusive prevents another launch
v = os.statvfs(permit['candidateRoot'])
durable_new(ROOT / 'one-shot-retire-reservation.json', encoded({
    'atUnix': time.time(), 'runId': run_id, 'freeBytes': v.f_bavail * v.f_frsize,
    'sourceSha256': EXPECTED, 'supervisorPolicy': [123, .5, 2, 1048576],
    'scope': 'one qualified tree, exact payload map only', 'state': 'UNKNOWN_UNTIL_REPORT'}))
spec = importlib.util.spec_from_file_location('ops14_exact_payload', SUPERVISOR)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
report = module.supervise(module.Launch(
    (sys.executable, '-B', str(OPERATOR), '--permit', str(permit_path), '--manifest', str(MANIFEST)),
    '/private/tmp', {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'PYTHONDONTWRITEBYTECODE': '1'},
    module.Ownership.NEW_CHILD_SESSION), module.Policy(123, .5, 2, 1048576))
assert len(report.stdout) + len(report.stderr) <= 1048576
durable_new(ROOT / 'one-shot-retire.stdout', report.stdout)
durable_new(ROOT / 'one-shot-retire.stderr', report.stderr)
metadata = {k: v for k, v in vars(report).items() if k not in ('stdout', 'stderr')}
v = os.statvfs(permit['candidateRoot'])
metadata.update({'runId': run_id, 'atUnix': time.time(), 'afterFreeBytes': v.f_bavail * v.f_frsize,
                 'stdoutSha256': hashlib.sha256(report.stdout).hexdigest(),
                 'stderrSha256': hashlib.sha256(report.stderr).hexdigest()})
assert len(encoded(metadata)) <= 16384
durable_new(ROOT / 'one-shot-retire-supervision.json', encoded(metadata))
print(json.dumps(metadata))
