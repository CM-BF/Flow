"""REQ15 two-path tests/strict checks using the already reviewed local supervisor."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
HERE = ROOT / 'docs/evidence/req15-turn-page-batch'
SUPERVISOR = ROOT.parent / 'server-transaction-disconnect/docs/evidence/svc07/execute-pg-once.py'
SUPERVISOR_SHA = '982c2e5a7a1acc98256413ceaf84c9b207a7ec481bbeb0c0462bc41892b51dc0'
assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() == SUPERVISOR_SHA
spec = importlib.util.spec_from_file_location('req15_supervisor', SUPERVISOR)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
shared.ROOT = ROOT  # In-process cwd injection only; the SVC07 module/file is unchanged.
parser = argparse.ArgumentParser()
parser.add_argument('kind', choices=['tests', 'types'])
parser.add_argument('label')
args = parser.parse_args()
assert re.fullmatch(r'[a-z0-9-]{1,30}', args.label)
command = [shared.NODE] + (['node_modules/vitest/vitest.mjs', 'run',
    'apps/server/src/assistant/final-preview-batch.test.ts', 'apps/server/src/conversations/turn-page-batch.test.ts',
    '--config', 'docs/evidence/req15-turn-page-batch/vitest.config.mjs', '--configLoader', 'runner',
    '--no-cache', '--reporter', 'verbose', '--no-color'] if args.kind == 'tests' else
    ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'docs/evidence/req15-turn-page-batch/tsconfig.json'])
for item in json.loads((HERE / 'dependency-request.json').read_text())['entries']:
    path = Path(item['link'])
    assert str(path.resolve()) == item['realpath'] and shared.digest(path / 'package.json') == item['packageJsonSha256']
disk = os.statvfs(ROOT); free = disk.f_bavail * disk.f_frsize
if free < 1107296256:
    print(json.dumps({'state': 'HOLD_NOT_RUN', 'availableBytes': free, 'floorBytes': 1107296256}))
    raise SystemExit(2)
receipt_path = HERE / (args.label + '.json'); log_path = HERE / (args.label + '.log'); temporary = HERE / (args.label + '-tmp')
for path in [receipt_path, log_path, temporary]:
    assert not path.exists() and not path.is_symlink(), 'Existing evidence must be preserved'
record = {'state': 'RUNNING', 'at': shared.stamp(), 'command': command, 'cwd': str(ROOT), 'availableBeforeBytes': free,
          'supervisorPath': str(SUPERVISOR), 'supervisorSha256': SUPERVISOR_SHA, 'pg': 0, 'http': 0,
          'tmpBudgetBytes': 33554432, 'tmpMeasurement': 'before/after sample, not realtime isolation',
          'sources': {str(p.relative_to(ROOT)): shared.digest(p) for folder in ['assistant', 'conversations']
                      for p in (ROOT / 'apps/server/src' / folder).glob('*.ts') if p.name in
                      ['store.ts','index.ts','queries.ts','state.ts','replies.ts','turn-read.ts','final-preview-batch.test.ts','turn-page-batch.test.ts']}}
fd = os.open(receipt_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as receipt:
    def save():
        receipt.seek(0); receipt.truncate(); receipt.write(json.dumps(record, indent=2) + '\n'); receipt.flush(); os.fsync(receipt.fileno())
    save(); beginning = time.monotonic()
    temporary.mkdir(mode=0o700); info = temporary.lstat(); identity = (info.st_dev, info.st_ino)
    record['temporary'] = {'device': info.st_dev, 'inode': info.st_ino, 'beforeBytes': 0, 'absentAfter': False}
    env = dict(os.environ)
    for key in ['NODE_COMPILE_CACHE','NODE_PG_FORCE_NATIVE','FLOW_COORDINATION_DATABASE_URL','FLOW_SVC07_TEST_ADMIN','TEST_DATABASE_URL','DATABASE_URL']:
        env.pop(key, None)
    env.update(TMPDIR=str(temporary), NODE_DISABLE_COMPILE_CACHE='1', NO_COLOR='1')
    def spawned(value):
        record['spawn'] = value; save()
    try:
        log_fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(log_fd, 'wb') as log:
            record['process'] = shared.supervise(command, env, log, beginning + 27, on_spawn=spawned)
        raw = log_path.read_bytes(); record['rawBytes'] = len(raw); record['rawSha256'] = hashlib.sha256(raw).hexdigest()
        entries = list(temporary.iterdir())
        record['temporary']['entriesAfter'] = len(entries)
        record['temporary']['afterBytes'] = sum(p.lstat().st_size for p in entries)
        assert not entries, 'Unexpected TMP content retained; no recursive cleanup'
        after = temporary.lstat(); assert (after.st_dev, after.st_ino) == identity and temporary.is_dir() and not temporary.is_symlink()
        temporary.rmdir(); record['temporary']['absentAfter'] = True
        text = raw.decode('utf8', errors='replace')
        summary = next((line.strip() for line in text.splitlines() if re.match(r'^\s*Tests\s', line)), None)
        record['testSummary'] = summary
        if args.kind == 'tests' and summary:
            record['selected'] = int(re.search(r'\((\d+)\)', summary)[1])
            passed = re.search(r'(\d+) passed', summary); record['passed'] = int(passed[1]) if passed else 0
        record['state'] = 'COMPLETED' if record['process']['rawComplete'] and record['process']['groupAbsent'] else 'UNKNOWN'
    except Exception as error:
        record['state'] = 'UNKNOWN'; record['secondaryFailure'] = type(error).__name__
    finally:
        record['endedAt'] = shared.stamp(); record['wallSeconds'] = time.monotonic() - beginning; save()
print(json.dumps(record, indent=2))
raise SystemExit(record.get('process', {}).get('exit') or (0 if record['state'] == 'COMPLETED' else 1))
