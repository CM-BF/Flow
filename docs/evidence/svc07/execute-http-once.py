#!/usr/bin/env python3
"""One SVC07 HTTP consumer journey; reuse the reviewed owned-process supervisor."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('svc07_supervisor', HERE / 'execute-pg-once.py')
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
OUTPUTS = ['http-run-reservation.json', 'http-database.json', 'http-server-1.json', 'http-server-2.json',
           'http-result.json', 'http-output.log', 'http-exit.json', 'http-tmp']
COMMAND = [shared.NODE, 'node_modules/vitest/vitest.mjs', 'run', 'docs/evidence/svc07/http-consumer.test.ts',
           '--config', 'docs/evidence/svc07/http-vitest.config.mjs', '--configLoader', 'runner',
           '--no-cache', '--reporter', 'verbose', '--no-color']


def preflight(expected_head, expected_manifest):
    manifest = HERE / 'http-prepared-manifest.json'
    if shared.digest(manifest) != expected_manifest:
        raise ValueError('Manifest changed')
    for entry in json.loads(manifest.read_text())['files']:
        name = Path(entry['path']); path = ROOT / name
        if name.is_absolute() or '..' in name.parts or path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            raise ValueError('Invalid input path')
        if path.stat().st_size != entry['bytes'] or shared.digest(path) != entry['sha256']:
            raise ValueError('Input changed')
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, timeout=2).decode().strip() != expected_head:
        raise ValueError('HEAD changed')
    if subprocess.check_output(['git', 'status', '--porcelain=v1'], cwd=ROOT, timeout=2).strip():
        raise ValueError('Worktree not clean')
    for name in OUTPUTS:
        try:
            (HERE / name).lstat()
        except FileNotFoundError:
            continue
        raise ValueError('Existing output must be retained')
    links = json.loads((HERE / 'dependency-links.json').read_text())['entries']
    links += json.loads((HERE / 'http-provision-request.json').read_text())['additionalDependencyLinks']
    for entry in links:
        link = Path(entry['link'])
        if str(link.resolve()) != entry['realpath'] or shared.digest(link / 'package.json') != entry['packageJsonSha256']:
            raise ValueError('Dependency changed')
    if not os.environ.get('FLOW_SVC07_TEST_ADMIN'):
        raise ValueError('Authorized admin configuration absent')
    ledger = subprocess.run([shared.NODE, '/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs', 'list'],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=3, check=True)
    assignments = json.loads(ledger.stdout)
    claim = next(row for row in assignments['claims'] if row['claimId'] == shared.CLAIM)
    expected = {'taskId': 'SVC07', 'role': 'writer', 'lead': 'mika', 'worker': 'db_transaction_owner', 'version': 1,
                'state': 'active', 'worktree': str(ROOT), 'branch': 'codex/server-transaction-disconnect'}
    if assignments['state'] != 'available' or any(claim[key] != value for key, value in expected.items()):
        raise ValueError('Claim not confirmed')
    if set(claim['scope']) != {'apps/server/src/database.ts', 'apps/server/src/database-transaction.test.ts', 'plans/svc07-transaction-recovery', 'docs/evidence/svc07'}:
        raise ValueError('Claim scope changed')
    disk = os.statvfs(ROOT); free = disk.f_bavail * disk.f_frsize
    if free < 1207959552 or free - 67108864 < 1073741824:
        raise ValueError('Fresh disk floor failed')
    return {'head': expected_head, 'manifestSha256': expected_manifest, 'availableBeforeBytes': free,
            'claimId': shared.CLAIM, 'claimVersion': 1, 'claimObservedAt': assignments['observedAt']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-head', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    args = parser.parse_args()
    beginning = time.monotonic(); wall_start = time.time()
    try:
        gate = preflight(args.expected_head, args.manifest_sha256)
    except Exception:
        print(json.dumps({'state': 'HOLD', 'reason': 'Fresh HTTP preflight not confirmed; no attempt opened'}))
        return 2
    record = {'state': 'RUNNING', 'startedAt': shared.stamp(), 'gate': gate, 'command': COMMAND}
    fd = os.open(HERE / 'http-exit.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as receipt:
        receipt.write(json.dumps(record) + '\n'); receipt.flush()
        temporary = HERE / 'http-tmp'; identity = None
        try:
            temporary.mkdir(mode=0o700); info = temporary.lstat(); identity = (info.st_dev, info.st_ino)
            record['temporary'] = {'path': str(temporary), 'device': info.st_dev, 'inode': info.st_ino, 'absentAfter': False}
            env = dict(os.environ); env.pop('NODE_PG_FORCE_NATIVE', None); env.pop('NODE_COMPILE_CACHE', None)
            env.update(TMPDIR=str(temporary), NODE_DISABLE_COMPILE_CACHE='1', NO_COLOR='1', FLOW_SVC07_HTTP_OPEN='1',
                       FLOW_SVC07_HTTP_WORK_UNTIL=str(int((wall_start + 40) * 1000)),
                       FLOW_SVC07_HTTP_CLEANUP_UNTIL=str(int((wall_start + 55) * 1000)))
            log_fd = os.open(HERE / 'http-output.log', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            def save_spawn(spawn):
                record['spawn'] = spawn
                receipt.seek(0); receipt.truncate(); receipt.write(json.dumps(record) + '\n'); receipt.flush(); os.fsync(receipt.fileno())
            with os.fdopen(log_fd, 'wb') as log:
                result = shared.supervise(COMMAND, env, log, beginning + 57, on_spawn=save_spawn)
                record['process'] = result
            record['rawSha256'] = shared.digest(HERE / 'http-output.log')
            detail, size = shared.read_owned_json(HERE / 'http-result.json', 32768)
            for name in ['http-run-reservation.json', 'http-database.json', 'http-server-1.json', 'http-server-2.json']:
                _, more = shared.read_owned_json(HERE / name, 32768); size += more
            if size > 32768:
                raise ValueError('Evidence over budget')
            record['resultBytes'] = size
            record['database'] = {'name': detail['database'], 'marker': detail['marker'], 'identity': detail['databaseIdentity'], 'cleanup': detail['cleanup']}
            record['listeners'] = detail['listeners']; record['assertions'] = detail['assertions']; record['httpRequests'] = detail['httpRequests']
            passed = (result['exit'] == 0 and result['rawComplete'] and result['groupAbsent']
                      and detail['cleanup']['status'] == 'CONFIRMED' and detail['cleanup']['connectionsZero']
                      and detail['cleanup']['databaseAbsent'] and detail['cleanup']['appClosed'] and detail['cleanup']['adminClosed']
                      and not detail['primaryFailure'] and not detail['secondaryFailures'] and detail['unexpectedAdminErrors'] == 0
                      and len(detail['listeners']) == 2 and all(row['closed'] for row in detail['listeners'])
                      and len(detail['assertions']) == 4 and detail['httpRequests'] <= 24)
            record['state'] = 'PASSED' if passed else 'UNKNOWN'
        except Exception:
            record['state'] = 'UNKNOWN'
            record['reason'] = 'HTTP execution/evidence/cleanup unconfirmed; retain owned identities and outputs'
        finally:
            if identity is not None:
                try:
                    latest = temporary.lstat()
                    if (latest.st_dev, latest.st_ino) != identity or not stat.S_ISDIR(latest.st_mode):
                        raise ValueError('Temporary identity changed')
                    temporary.rmdir(); record['temporary']['absentAfter'] = True
                except Exception:
                    record['state'] = 'UNKNOWN'
            record['endedAt'] = shared.stamp(); record['wallSeconds'] = time.monotonic() - beginning
            if record['wallSeconds'] > 60:
                record['state'] = 'UNKNOWN'
            if record['state'] != 'PASSED':
                record['recovery'] = {'input': 'http-input.json', 'action': 'Read-only reconciliation of this exact DB/OID/marker/listeners/owned group; no automatic retry, terminate, or DROP'}
            receipt.seek(0); receipt.truncate(); receipt.write(json.dumps(record, indent=2) + '\n'); receipt.flush()
    print(json.dumps({'state': record['state'], 'wallSeconds': record['wallSeconds'], 'receipt': str(HERE / 'http-exit.json')}))
    return 0 if record['state'] == 'PASSED' else 1


if __name__ == '__main__':
    raise SystemExit(main())
