"""One authorized operation for two fixed, inactive, regenerable Vite caches."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

OUT = Path(__file__).resolve().parent
ROOT = Path('/Users/citrine/Projects/AgentHarness/Flow')
BASE = ROOT.parent / 'Flow-worktrees'
NAMES = ('web-workspace-cache', 'web-workspace-lifecycle-baseline')

def command(args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def free():
    observed = os.statvfs(ROOT)
    return observed.f_bavail * observed.f_frsize

def save(path, record, exclusive=False):
    with path.open('x' if exclusive else 'w') as output:
        json.dump(record, output, ensure_ascii=False, indent=2)
        output.write('\n')
        output.flush()
        os.fsync(output.fileno())

name = NAMES[int(sys.argv[1])]
audit = json.loads((OUT / 'nine-audit.json').read_text())
row = next(item for item in audit['items'] if item['tree'] == name)
confirmation = json.loads((OUT / 'manager-confirmation.json').read_text())
assert name in confirmation['eligibleExactCaches']
assert row['verdict'] == 'ELIGIBLE_LOCAL_PENDING_EXTERNAL_CHECK'
wt, cache = Path(row['worktree']), Path(row['cache'])
assert wt == BASE / name and cache == wt / 'apps/web/node_modules/.vite'
git = lambda *args: command(['git', '-C', str(wt), *args])
assert git('rev-parse', 'HEAD') == row['head']['value']
assert not git('status', '--porcelain')
assert not git('ls-files', '--', str(cache))
ledger = json.loads(command(['/opt/homebrew/opt/node@24/bin/node', '--env-file=/tmp/flow-coordination.env', 'apps/execution-dashboard/src/coordination/cli.mjs', 'list'], BASE / 'm2-integration'))
assert ledger['state'] == 'available'
assert not [claim for claim in ledger['claims'] if claim['worktree'] == str(wt) and claim['state'] != 'released']
opened = subprocess.run(['lsof', '-nP', '-Fn', '+D', str(wt)], text=True, capture_output=True, timeout=25)
assert opened.returncode in (0, 1) and not opened.stderr and not opened.stdout
processes = command(['ps', '-axo', 'pid=,command='])
assert str(wt) not in processes
for entry in row['pathComponents']:
    item = Path(entry['path']).lstat()
    assert stat.S_ISDIR(item.st_mode) and (item.st_dev, item.st_ino) == (entry['dev'], entry['ino'])
for entry in row['fileAudit']['directories']:
    item = (cache / entry['path']).lstat()
    assert stat.S_ISDIR(item.st_mode) and (item.st_dev, item.st_ino) == (entry['dev'], entry['ino'])
files = row['fileAudit']['files']
assert len(files) == 60 and sum(item['bytes'] for item in files) <= 18_000_000
expected = {item['path'] for item in files}
assert {str(path.relative_to(cache)) for path in cache.rglob('*') if not path.is_dir()} == expected
for entry in files:
    path = cache / entry['path']
    info = path.lstat()
    assert stat.S_ISREG(info.st_mode) and info.st_nlink == 1
    assert (info.st_dev, info.st_ino, info.st_size) == (entry['dev'], entry['ino'], entry['bytes'])
    assert digest(path) == entry['sha256']
siblings = {item.name: (item.lstat().st_dev, item.lstat().st_ino, item.lstat().st_mode) for item in cache.parent.iterdir() if item.name != '.vite'}
record = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'worktree': str(wt), 'cache': str(cache), 'head': row['head']['value'], 'auditSha256': digest(OUT / 'nine-audit.json'), 'managerConfirmationSha256': digest(OUT / 'manager-confirmation.json'), 'ledgerObservedAt': ledger['observedAt'], 'freeBeforeBytes': free(), 'state': 'PREPARED', 'deleted': [], 'dependenciesTouched': False, 'processesStopped': 0}
result = OUT / (name + '-cleanup.json')
assert not result.exists()
save(OUT / (name + '-intent.json'), record, exclusive=True)
directory_fd = os.open(OUT, os.O_RDONLY | os.O_DIRECTORY)
os.fsync(directory_fd)
os.close(directory_fd)
try:
    if record['freeBeforeBytes'] >= 1_241_513_984:
        record['state'] = 'NOT_RUN_PREPARE_MARGIN_REACHED'
    else:
        for entry in files:
            path = cache / entry['path']
            parent = next(item for item in row['fileAudit']['directories'] if item['path'] == str(Path(entry['path']).parent))
            parent_info = path.parent.lstat()
            assert stat.S_ISDIR(parent_info.st_mode) and (parent_info.st_dev, parent_info.st_ino) == (parent['dev'], parent['ino'])
            info = path.lstat()
            assert stat.S_ISREG(info.st_mode) and info.st_nlink == 1
            assert (info.st_dev, info.st_ino, info.st_size) == (entry['dev'], entry['ino'], entry['bytes'])
            path.unlink()
            record['deleted'].append(entry['path'])
        assert not [path for path in cache.rglob('*') if not path.is_dir()]
        assert siblings == {item.name: (item.lstat().st_dev, item.lstat().st_ino, item.lstat().st_mode) for item in cache.parent.iterdir() if item.name != '.vite'}
        assert git('rev-parse', 'HEAD') == record['head'] and not git('status', '--porcelain')
        record['state'] = 'COMPLETE'
except BaseException as error:
    record['state'] = 'UNKNOWN_PARTIAL_KEEP'
    record['errorType'] = type(error).__name__
    raise
finally:
    try:
        record['freeAfterBytes'] = free()
        record['observedVolumeDeltaBytes'] = record['freeAfterBytes'] - record['freeBeforeBytes']
    except BaseException as observation_error:
        record['freeAfterBytes'] = None
        record['observedVolumeDeltaBytes'] = None
        record['spaceObservationErrorType'] = type(observation_error).__name__
        if record['state'] == 'COMPLETE':
            record['state'] = 'COMPLETE_SPACE_OBSERVATION_UNKNOWN'
    record['attribution'] = 'Shared-volume observation; not exclusive APFS reclaim proof'
    record['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        save(result, record, exclusive=True)
    except BaseException as persistence_error:
        print(json.dumps({'state': 'UNKNOWN_RESULT_PERSISTENCE', 'primaryErrorType': record.get('errorType'), 'persistenceErrorType': type(persistence_error).__name__, 'deletedCount': len(record['deleted'])}), file=sys.stderr)
        if 'errorType' not in record:
            raise
print(json.dumps({key: record[key] for key in ('state', 'cache', 'freeBeforeBytes', 'freeAfterBytes', 'observedVolumeDeltaBytes')}))
