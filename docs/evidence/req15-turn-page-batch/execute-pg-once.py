#!/usr/bin/env python3
"""REQ15 owned read fixture only. No service control, recovery, or automatic retry."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
from datetime import datetime, timezone

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
HERE = ROOT / 'docs/evidence/req15-turn-page-batch'
NODE = '/opt/homebrew/opt/node@24/bin/node'
SUPERVISOR = ROOT.parent / 'server-transaction-disconnect/docs/evidence/svc07/execute-pg-once.py'
SUPERVISOR_SHA = '982c2e5a7a1acc98256413ceaf84c9b207a7ec481bbeb0c0462bc41892b51dc0'
CLAIM = '09b83400-e41f-4e6c-a5a9-08ae340b74db'
OUTPUTS = ['pg-run-reservation.json', 'pg-database.json', 'pg-result.json', 'pg-output.log', 'pg-exit.json', 'pg-tmp']
COMMAND = [NODE, 'node_modules/vitest/vitest.mjs', 'run',
           'docs/evidence/req15-turn-page-batch/pg-turn-page.test.ts', '--config',
           'docs/evidence/req15-turn-page-batch/pg-vitest.config.mjs', '--configLoader', 'runner',
           '--no-cache', '--reporter', 'verbose', '--no-color']


def stamp():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(*arguments):
    return subprocess.check_output(['git', *arguments], cwd=ROOT, timeout=2).decode().strip()


def preflight(expected_head, expected_manifest):
    manifest_path = HERE / 'pg-prepared-manifest.json'
    if digest(manifest_path) != expected_manifest:
        raise ValueError('Manifest changed')
    for entry in json.loads(manifest_path.read_text())['files']:
        relative = Path(entry['path'])
        path = ROOT / relative
        if relative.is_absolute() or '..' in relative.parts or path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            raise ValueError('Invalid input path')
        if not path.is_file() or path.stat().st_size != entry['bytes'] or digest(path) != entry['sha256']:
            raise ValueError('Input changed')
    if git('rev-parse', 'HEAD') != expected_head or git('branch', '--show-current') != 'codex/conversation-turn-page-batch' or git('status', '--porcelain=v1'):
        raise ValueError('Branch/HEAD/clean gate failed')
    for entry in json.loads((HERE / 'dependency-request.json').read_text())['entries']:
        path = Path(entry['link'])
        if str(path.resolve()) != entry['realpath'] or digest(path / 'package.json') != entry['packageJsonSha256']:
            raise ValueError('Dependency changed')
        if path.name == 'contracts' and not path.resolve().is_relative_to(ROOT):
            raise ValueError('Contracts must belong to this worktree')
    for entry in json.loads((HERE / 'pg-driver-inputs.json').read_text())['files']:
        path = Path(entry['path'])
        if path.stat().st_size != entry['bytes'] or digest(path) != entry['sha256']:
            raise ValueError('Pinned observational driver changed')
    if digest(SUPERVISOR) != SUPERVISOR_SHA:
        raise ValueError('Approved supervisor changed; no implicit migration')
    for name in OUTPUTS:
        try:
            (HERE / name).lstat()
        except FileNotFoundError:
            continue
        raise ValueError('Existing output must be preserved')
    if not os.environ.get('FLOW_REQ15_TEST_ADMIN'):
        raise ValueError('Missing authorized admin configuration')
    ledger = subprocess.run([NODE, '/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs', 'list'],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=3, check=True)
    assignment = json.loads(ledger.stdout)
    claim = next(row for row in assignment['claims'] if row['claimId'] == CLAIM)
    original = json.loads((HERE / 'claim-receipt.json').read_text())['claim']
    keys = ['claimId', 'version', 'taskId', 'role', 'lead', 'worker', 'worktree', 'branch']
    if assignment['state'] != 'available' or claim['state'] != 'active' or claim['worktree'] != str(ROOT) or any(claim[key] != original[key] for key in keys) or set(claim['scope']) != set(original['scope']):
        raise ValueError('Own active claim not confirmed')
    disk = os.statvfs(ROOT); free = disk.f_bavail * disk.f_frsize
    if free < 1207959552 or free - 67108864 < 1073741824:
        raise ValueError('PG disk floor failed')
    return {'head': expected_head, 'manifestSha256': expected_manifest, 'claimId': CLAIM, 'claimVersion': 1,
            'claimObservedAt': assignment['observedAt'], 'availableBeforeBytes': free}


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
        spec = importlib.util.spec_from_file_location('req15_fixed_supervisor', SUPERVISOR)
        shared = importlib.util.module_from_spec(spec); spec.loader.exec_module(shared)
        shared.ROOT = ROOT  # Private in-process cwd seam; never invoke or edit the SVC07 main.
    except Exception as error:
        reason = str(error) if type(error) is ValueError else type(error).__name__
        print(json.dumps({'state': 'HOLD_NOT_RUN', 'reason': reason, 'fixtureOpened': False}))
        return 2
    record = {'state': 'RUNNING', 'startedAt': stamp(), 'gate': gate, 'command': COMMAND, 'cwd': str(ROOT),
              'supervisorPath': str(SUPERVISOR), 'supervisorSha256': SUPERVISOR_SHA,
              'wholeBudgetSeconds': 30, 'rawBudgetBytes': 65536, 'tmpBudgetBytes': 33554432,
              'tmpMeasurement': 'before/after sample, not realtime isolation', 'secondaryFailures': []}
    receipt_fd = os.open(HERE / 'pg-exit.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(receipt_fd, 'w') as receipt:
        def save():
            receipt.seek(0); receipt.truncate(); receipt.write(json.dumps(record, indent=2) + '\n'); receipt.flush(); os.fsync(receipt.fileno())
        save()
        temporary = HERE / 'pg-tmp'; temp_identity = None
        try:
            temporary.mkdir(mode=0o700); info = temporary.lstat(); temp_identity = (info.st_dev, info.st_ino)
            record['temporary'] = {'device': info.st_dev, 'inode': info.st_ino, 'beforeBytes': 0, 'absentAfter': False}
            env = dict(os.environ)
            for key in ['NODE_COMPILE_CACHE', 'NODE_PG_FORCE_NATIVE', 'FLOW_COORDINATION_DATABASE_URL',
                        'FLOW_SVC07_TEST_ADMIN', 'FLOW_SVC07_HTTP_OPEN', 'DATABASE_URL', 'TEST_DATABASE_URL']:
                env.pop(key, None)
            env.update(TMPDIR=str(temporary), NODE_DISABLE_COMPILE_CACHE='1', NO_COLOR='1', FLOW_REQ15_PG_OPEN='1',
                       FLOW_REQ15_WORK_DEADLINE=str(int((wall_start + 20) * 1000)),
                       FLOW_REQ15_CLEANUP_DEADLINE=str(int((wall_start + 27) * 1000)))
            log_fd = os.open(HERE / 'pg-output.log', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            def spawned(value):
                record['spawn'] = value; save()  # Preserve PID/PGID immediately, even if supervision later fails.
            with os.fdopen(log_fd, 'wb') as log:
                record['process'] = shared.supervise(COMMAND, env, log, beginning + 27, on_spawn=spawned)
            process = record['process']
            # A nonzero business exit can still have complete EOF/capture. Keep these facts separate.
            record['captureComplete'] = process['stdoutEof'] and process['observedBytes'] == process['retainedBytes'] and process['reason'] is None
            record['lifecycleKnown'] = (process['groupAbsent'] and not process['secondaryFailures']
                and all(item['state'] != 'unknown' for item in process['observations'] + process['signals']))
            record['rawSha256'] = digest(HERE / 'pg-output.log')
            record['rawBytes'] = (HERE / 'pg-output.log').stat().st_size
            raw = (HERE / 'pg-output.log').read_bytes().decode('utf8', errors='replace')
            summary = next((line.strip() for line in raw.splitlines() if re.match(r'^\s*Tests\s', line)), None)
            record['testSummary'] = summary
            count = re.search(r'\((\d+)\)', summary) if summary else None
            passed_count = re.search(r'(\d+) passed', summary) if summary else None
            record['selected'] = int(count[1]) if count else None
            record['passed'] = int(passed_count[1]) if passed_count else 0
            details, size = shared.read_owned_json(HERE / 'pg-result.json', 32768)
            identity, identity_size = shared.read_owned_json(HERE / 'pg-database.json', 32768)
            _, reservation_size = shared.read_owned_json(HERE / 'pg-run-reservation.json', 32768)
            if size + identity_size + reservation_size > 32768:
                raise ValueError('Combined result budget exceeded')
            record['resultBytes'] = size + identity_size + reservation_size
            record['database'] = {'identity': identity, 'cleanup': details['cleanup']}
            record['completedCases'] = [item['id'] for item in details['cases'] if item['passed'] is True]
            clean = details['cleanup']
            behavior_passed = (process['exit'] == 0 and record['selected'] == 2 and record['passed'] == 2
                and record['completedCases'] == ['PG1', 'PG2'] and not details['primaryFailure'] and details['unexpectedPoolErrors'] == 0)
            record['behavior'] = 'PASSED' if behavior_passed else 'FAILED' if process['exit'] is not None else 'UNKNOWN'
            closure = (clean['status'] == 'CONFIRMED' and all(clean[key] for key in ['originalsSettled', 'subjectEndAcknowledged', 'writerEndAcknowledged', 'connectionsZero', 'databaseAbsent', 'adminEndAcknowledged']))
            record['state'] = 'PASSED' if behavior_passed and closure and record['captureComplete'] and record['lifecycleKnown'] else 'UNKNOWN'
        except Exception as error:
            record['state'] = 'UNKNOWN'; record['secondaryFailures'].append({'phase': 'execution/evidence', 'type': type(error).__name__})
        finally:
            if temp_identity is not None:
                try:
                    latest = temporary.lstat()
                    if (latest.st_dev, latest.st_ino) != temp_identity or not stat.S_ISDIR(latest.st_mode):
                        raise ValueError('Temporary identity changed')
                    entries = list(temporary.iterdir())
                    record['temporary']['entriesAfter'] = len(entries)
                    record['temporary']['afterBytes'] = sum(path.lstat().st_size for path in entries)
                    if entries:
                        raise ValueError('Unexpected temporary content retained; no recursive cleanup')
                    temporary.rmdir(); record['temporary']['absentAfter'] = True
                except Exception as error:
                    record['state'] = 'UNKNOWN'; record['secondaryFailures'].append({'phase': 'temporary', 'type': type(error).__name__})
            record['endedAt'] = stamp(); record['wallSeconds'] = time.monotonic() - beginning
            if record['wallSeconds'] > 30:
                record['state'] = 'UNKNOWN'; record['secondaryFailures'].append({'phase': 'whole-window', 'type': 'Deadline'})
            if record['state'] != 'PASSED':
                record['recovery'] = 'Read-only reconciliation of pg-input/database/spawn identities; no retry, terminate, FORCE or automatic DROP'
            save()
    print(json.dumps({'state': record['state'], 'wallSeconds': record['wallSeconds'], 'receipt': str(HERE / 'pg-exit.json')}))
    return 0 if record['state'] == 'PASSED' else 1


if __name__ == '__main__':
    raise SystemExit(main())
