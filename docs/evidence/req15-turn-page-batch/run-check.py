"""REQ15 fixed local checks using the already reviewed local supervisor."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import time

beginning = time.monotonic()
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
commands = {
    'tests': ['node_modules/vitest/vitest.mjs', 'run',
    'apps/server/src/assistant/final-preview-batch.test.ts', 'apps/server/src/conversations/turn-page-batch.test.ts',
    '--config', 'docs/evidence/req15-turn-page-batch/vitest.config.mjs', '--configLoader', 'runner',
    '--no-cache', '--reporter', 'verbose', '--no-color'],
    'pages-main': ['node_modules/vitest/vitest.mjs', 'run',
    'apps/server/src/conversations/turn-page-batch.test.ts', '--config',
    'docs/evidence/req15-turn-page-batch/main-database-vitest.config.mjs', '--configLoader', 'runner',
    '--no-cache', '--reporter', 'verbose', '--no-color'],
    'http-types': ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'docs/evidence/req15-turn-page-batch/tsconfig.http.json'],
    'http-collect': ['node_modules/vitest/vitest.mjs', 'list',
    'docs/evidence/req15-turn-page-batch/http-consumer.test.ts', '--config',
    'docs/evidence/req15-turn-page-batch/http-vitest.config.mjs', '--configLoader', 'runner', '--no-cache', '--json', '--no-color'],
    'types': ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'docs/evidence/req15-turn-page-batch/tsconfig.json'],
    'pg-types': ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'docs/evidence/req15-turn-page-batch/tsconfig.pg.json'],
    'pg-collect': ['node_modules/vitest/vitest.mjs', 'list',
    'docs/evidence/req15-turn-page-batch/pg-turn-page.test.ts', '--config',
    'docs/evidence/req15-turn-page-batch/pg-vitest.config.mjs', '--configLoader', 'runner', '--no-cache', '--json', '--no-color'],
}
parser = argparse.ArgumentParser()
parser.add_argument('kind', choices=commands)
parser.add_argument('label')
args = parser.parse_args()
assert re.fullmatch(r'[a-z0-9-]{1,30}', args.label)
command = [shared.NODE, *commands[args.kind]]
for item in json.loads((HERE / 'dependency-request.json').read_text())['entries']:
    path = Path(item['link'])
    assert str(path.resolve()) == item['realpath'] and shared.digest(path / 'package.json') == item['packageJsonSha256']
if args.kind in ['http-types', 'http-collect']:
    for item in json.loads((HERE / 'http-source-receipt.json').read_text())['files']:
        source = ROOT / item['path']
        assert source.stat().st_size == item['bytes'] and shared.digest(source) == item['sha256']
    for item in json.loads((HERE / 'http-dependencies.json').read_text())['links']:
        link = ROOT / item['path']
        assert str(link.resolve()) == item['target'] and shared.digest(link / 'package.json') == item['packageJsonSha256']
disk = os.statvfs(ROOT); free = disk.f_bavail * disk.f_frsize
if free < 1107296256:
    print(json.dumps({'state': 'HOLD_NOT_RUN', 'availableBytes': free, 'floorBytes': 1107296256}))
    raise SystemExit(2)
if time.monotonic() - beginning >= 27:
    print(json.dumps({'state': 'HOLD_NOT_RUN', 'reason': 'Local preflight consumed the work budget'}))
    raise SystemExit(2)
receipt_path = HERE / (args.label + '.json'); log_path = HERE / (args.label + '.log'); temporary = HERE / (args.label + '-tmp')
for path in [receipt_path, log_path, temporary]:
    assert not path.exists() and not path.is_symlink(), 'Existing evidence must be preserved'
record = {'state': 'RUNNING', 'at': shared.stamp(), 'kind': args.kind, 'command': command, 'cwd': str(ROOT), 'availableBeforeBytes': free,
          'supervisorPath': str(SUPERVISOR), 'supervisorSha256': SUPERVISOR_SHA, 'pg': 0, 'http': 0,
          'tmpBudgetBytes': 8388608 if args.kind in ['pages-main', 'http-types', 'http-collect'] else 33554432, 'tmpMeasurement': 'before/after sample, not realtime isolation',
          'elapsedBasis': 'wrapper preflight through cleanup before final receipt; excludes interpreter startup and final persistence',
          'sources': {str(p.relative_to(ROOT)): shared.digest(p) for folder in ['assistant', 'conversations']
                      for p in (ROOT / 'apps/server/src' / folder).glob('*.ts') if p.name in
                      ['store.ts','index.ts','queries.ts','state.ts','replies.ts','turn-read.ts','final-preview-batch.test.ts','turn-page-batch.test.ts']}}
if args.kind == 'pages-main':
    record['mainDatabase'] = {
        'donorCommit': '8c80a7105cf442783e83184a14e34c8da08ebe16',
        'path': 'docs/evidence/req15-turn-page-batch/main-database.ts',
        'sha256': shared.digest(HERE / 'main-database.ts'),
        'configSha256': shared.digest(HERE / 'main-database-vitest.config.mjs'),
    }
if args.kind in ['http-types', 'http-collect']:
    record['httpPreparation'] = {name: shared.digest(HERE / name) for name in
        ['http-source-receipt.json', 'http-dependencies.json', 'http-consumer.test.ts', 'http-input.json', 'http-vitest.config.mjs', 'tsconfig.http.json']}
    record['rawBudgetBytes'] = 32768
fd = os.open(receipt_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as receipt:
    def save():
        receipt.seek(0); receipt.truncate(); receipt.write(json.dumps(record, indent=2) + '\n'); receipt.flush(); os.fsync(receipt.fileno())
    save()
    temporary.mkdir(mode=0o700); info = temporary.lstat(); identity = (info.st_dev, info.st_ino)
    record['temporary'] = {'device': info.st_dev, 'inode': info.st_ino, 'beforeBytes': 0, 'absentAfter': False}
    env = dict(os.environ)
    for key in ['NODE_COMPILE_CACHE','NODE_PG_FORCE_NATIVE','FLOW_COORDINATION_DATABASE_URL','FLOW_SVC07_TEST_ADMIN',
                'FLOW_SVC07_HTTP_OPEN','FLOW_REQ15_TEST_ADMIN','FLOW_REQ15_PG_OPEN','FLOW_REQ15_WORK_DEADLINE',
                'FLOW_REQ15_CLEANUP_DEADLINE','FLOW_REQ15_HTTP_OPEN','FLOW_REQ15_HTTP_WORK_UNTIL','FLOW_REQ15_HTTP_CLEANUP_UNTIL','TEST_DATABASE_URL','DATABASE_URL']:
        env.pop(key, None)
    env.update(TMPDIR=str(temporary), NODE_DISABLE_COMPILE_CACHE='1', NO_COLOR='1')
    def spawned(value):
        record['spawn'] = value; save()
    try:
        log_fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(log_fd, 'wb') as log:
            record['process'] = shared.supervise(command, env, log, beginning + 27, limit=32768 if args.kind.startswith('http-') else 65536, on_spawn=spawned)
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
        if args.kind in ['tests', 'pages-main'] and summary:
            record['selected'] = int(re.search(r'\((\d+)\)', summary)[1])
            passed = re.search(r'(\d+) passed', summary); record['passed'] = int(passed[1]) if passed else 0
        if args.kind in ['pg-collect', 'http-collect']:
            fixture_name = 'pg-turn-page.test.ts' if args.kind == 'pg-collect' else 'http-consumer.test.ts'
            collected = json.loads(text)
            if not isinstance(collected, list) or any(item.get('file') != str(HERE / fixture_name) for item in collected):
                raise ValueError('Collected files differ from the fixed fixture')
            record['collected'] = len(collected)
            record['testPasses'] = None
        record['state'] = 'COMPLETED' if record['process']['rawComplete'] and record['process']['groupAbsent'] else 'UNKNOWN'
        if args.kind in ['pg-collect', 'http-collect'] and record['collected'] != (2 if args.kind == 'pg-collect' else 1) and record['state'] == 'COMPLETED':
            record['state'] = 'FAILED'; record['collectionMismatch'] = True
    except Exception as error:
        record['state'] = 'UNKNOWN'; record['secondaryFailure'] = type(error).__name__
    finally:
        record['endedAt'] = shared.stamp(); record['wallSeconds'] = time.monotonic() - beginning
        if record['wallSeconds'] > 30:
            record['state'] = 'UNKNOWN'; record['wholeWindowExceeded'] = True
        save()
print(json.dumps(record, indent=2))
raise SystemExit(record.get('process', {}).get('exit') or (0 if record['state'] == 'COMPLETED' else 1))
