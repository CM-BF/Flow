#!/usr/bin/env python3
"""One REQ15 HTTP consumer journey; reuse the reviewed owned-process supervisor."""
import argparse
from datetime import datetime, timezone
import importlib.util
import hashlib
import re
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
SUPERVISOR = ROOT.parent / 'server-transaction-disconnect/docs/evidence/svc07/execute-pg-once.py'
SUPERVISOR_SHA = '982c2e5a7a1acc98256413ceaf84c9b207a7ec481bbeb0c0462bc41892b51dc0'
if hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() != SUPERVISOR_SHA:
    raise ValueError('Pinned supervisor changed')
spec = importlib.util.spec_from_file_location('req15_http_supervisor', SUPERVISOR)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
shared.ROOT = ROOT
CLAIM = '09b83400-e41f-4e6c-a5a9-08ae340b74db'
OUTPUTS = ['http-run-reservation.json', 'http-database.json', 'http-server-1.json',
           'http-result.json', 'http-output.log', 'http-exit.json', 'http-tmp']
COMMAND = [shared.NODE, 'node_modules/vitest/vitest.mjs', 'run', 'docs/evidence/req15-turn-page-batch/http-consumer.test.ts',
           '--config', 'docs/evidence/req15-turn-page-batch/http-vitest.config.mjs', '--configLoader', 'runner',
           '--no-cache', '--reporter', 'verbose', '--no-color']


def process_closed(result):
    return bool(result and result['exit'] is not None and result['groupAbsent'] and result['stdoutEof']
                and not result['secondaryFailures']
                and all(row['state'] != 'unknown' for row in result['observations'] + result['signals']))


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
    for item in json.loads((HERE / 'http-dependencies.json').read_text())['links']:
        link = ROOT / item['path']
        if str(link.resolve()) != item['target'] or shared.digest(link / 'package.json') != item['packageJsonSha256']:
            raise ValueError('Snapshot dependency changed')
    for item in json.loads((HERE / 'dependency-request.json').read_text())['entries']:
        link = Path(item['link'])
        if str(link.resolve()) != item['realpath'] or shared.digest(link / 'package.json') != item['packageJsonSha256']:
            raise ValueError('Check runtime changed')
    if os.environ.get('FLOW_REQ15_HTTP_OPEN') != '1' or not os.environ.get('FLOW_REQ15_TEST_ADMIN'):
        raise ValueError('Explicit HTTP OPEN and authorized admin configuration required')
    ledger = subprocess.run([shared.NODE, '/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs', 'list'],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=3, check=True)
    assignments = json.loads(ledger.stdout)
    claim = next(row for row in assignments['claims'] if row['claimId'] == CLAIM)
    previous = json.loads((HERE / 'claim-state-replies-amend-receipt.json').read_text())['claim']
    keys = ['claimId', 'version', 'taskId', 'role', 'lead', 'worker', 'state', 'worktree', 'branch', 'scope']
    if assignments['state'] != 'available' or any(claim[key] != previous[key] for key in keys):
        raise ValueError('Current v2 claim not confirmed')
    if subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, timeout=2).decode().strip() != previous['branch']:
        raise ValueError('Branch changed')
    disk = os.statvfs(ROOT); free = disk.f_bavail * disk.f_frsize
    if free < 1207959552 or free - 67108864 < 1073741824:
        raise ValueError('Fresh disk floor failed')
    return {'head': expected_head, 'manifestSha256': expected_manifest, 'availableBeforeBytes': free,
            'claimId': CLAIM, 'claimVersion': 2, 'claimObservedAt': assignments['observedAt']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-head', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    args = parser.parse_args()
    beginning = time.monotonic(); wall_start = time.time()
    try:
        gate = preflight(args.expected_head, args.manifest_sha256)
        if time.monotonic() - beginning >= 8:
            raise ValueError('Preflight consumed work budget')
    except Exception:
        print(json.dumps({'state': 'HOLD', 'reason': 'Fresh HTTP preflight not confirmed; no attempt opened'}))
        return 2
    record = {'state': 'RUNNING', 'startedAt': shared.stamp(), 'gate': gate, 'command': COMMAND,
              'supervisorSha256': SUPERVISOR_SHA, 'wholeBudgetSeconds': 60, 'rawBudgetBytes': 65536, 'tmpBudgetBytes': 8388608,
              'elapsedBasis': 'preflight through cleanup before final receipt; excludes interpreter startup and final persistence'}
    fd = os.open(HERE / 'http-exit.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as receipt:
        receipt.write(json.dumps(record) + '\n'); receipt.flush(); os.fsync(receipt.fileno())
        temporary = HERE / 'http-tmp'; identity = None
        try:
            temporary.mkdir(mode=0o700); info = temporary.lstat(); identity = (info.st_dev, info.st_ino)
            record['temporary'] = {'path': str(temporary), 'device': info.st_dev, 'inode': info.st_ino, 'absentAfter': False}
            env = dict(os.environ)
            for key in ['NODE_PG_FORCE_NATIVE', 'NODE_COMPILE_CACHE', 'FLOW_COORDINATION_DATABASE_URL', 'FLOW_SVC07_TEST_ADMIN', 'DATABASE_URL', 'TEST_DATABASE_URL']:
                env.pop(key, None)
            env.update(TMPDIR=str(temporary), NODE_DISABLE_COMPILE_CACHE='1', NO_COLOR='1', FLOW_REQ15_HTTP_OPEN='1',
                       FLOW_REQ15_HTTP_WORK_UNTIL=str(int((wall_start + 40) * 1000)),
                       FLOW_REQ15_HTTP_CLEANUP_UNTIL=str(int((wall_start + 55) * 1000)))
            log_fd = os.open(HERE / 'http-output.log', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            def save_spawn(spawn):
                record['spawn'] = spawn
                receipt.seek(0); receipt.truncate(); receipt.write(json.dumps(record) + '\n'); receipt.flush(); os.fsync(receipt.fileno())
            with os.fdopen(log_fd, 'wb') as log:
                result = shared.supervise(COMMAND, env, log, beginning + 57, on_spawn=save_spawn)
                record['process'] = result
            record['rawSha256'] = shared.digest(HERE / 'http-output.log')
            detail, size = shared.read_owned_json(HERE / 'http-result.json', 32768)
            for name in ['http-run-reservation.json', 'http-database.json', 'http-server-1.json']:
                _, more = shared.read_owned_json(HERE / name, 32768); size += more
            if size > 32768:
                raise ValueError('Evidence over budget')
            record['resultBytes'] = size
            record['database'] = {'name': detail['database'], 'marker': detail['marker'], 'identity': detail['databaseIdentity'], 'cleanup': detail['cleanup']}
            record['listeners'] = detail['listeners']; record['assertions'] = detail['assertions']; record['httpRequests'] = detail['httpRequests']
            raw = (HERE / 'http-output.log').read_bytes()
            record['rawBytes'] = len(raw)
            plain = re.sub(r'\x1b\[[0-9;]*m', '', raw.decode('utf8', errors='replace'))
            summary = next((line.strip() for line in plain.splitlines() if re.match(r'^\s*Tests\s', line)), '')
            selected = re.search(r'\((\d+)\)', summary); passed_count = re.search(r'(\d+) passed', summary)
            record['selected'] = int(selected[1]) if selected else None
            record['passed'] = int(passed_count[1]) if passed_count else 0
            record['captureComplete'] = result['stdoutEof'] and result['observedBytes'] == result['retainedBytes'] and result['reason'] is None
            record['lifecycleKnown'] = process_closed(result)
            passed = (result['exit'] == 0 and record['selected'] == 1 and record['passed'] == 1 and record['captureComplete'] and record['lifecycleKnown']
                      and detail['cleanup']['status'] == 'CONFIRMED' and detail['cleanup']['connectionsZero']
                      and detail['cleanup']['databaseAbsent'] and detail['cleanup']['appClosed'] and detail['cleanup']['fixtureClosed'] and detail['cleanup']['adminClosed']
                      and not detail['primaryFailure'] and not detail['secondaryFailures'] and detail['unexpectedAdminErrors'] == 0 and detail['unexpectedFixtureErrors'] == 0
                      and len(detail['listeners']) == 1 and all(row['closed'] for row in detail['listeners'])
                      and detail['assertions'] == ['original-paging-lazy-detail-case', 'page-401-403'] and detail['httpRequests'] <= 64)
            record['behavior'] = 'PASSED' if result['exit'] == 0 and record['selected'] == 1 and record['passed'] == 1 and not detail['primaryFailure'] else 'FAILED'
            record['state'] = 'PASSED' if passed else 'UNKNOWN'
        except Exception:
            record['state'] = 'UNKNOWN'
            record['reason'] = 'HTTP execution/evidence/cleanup unconfirmed; retain owned identities and outputs'
        finally:
            if identity is not None:
                try:
                    if not process_closed(record.get('process')):
                        record['temporary']['retainedReason'] = 'PROCESS_LIFECYCLE_UNKNOWN'
                        raise ValueError('Keep temporary directory while process closure is unknown')
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
            receipt.seek(0); receipt.truncate(); receipt.write(json.dumps(record, indent=2) + '\n'); receipt.flush(); os.fsync(receipt.fileno())
    print(json.dumps({'state': record['state'], 'wallSeconds': record['wallSeconds'], 'receipt': str(HERE / 'http-exit.json')}))
    return 0 if record['state'] == 'PASSED' else 1


if __name__ == '__main__':
    raise SystemExit(main())
