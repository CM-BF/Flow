"""Future two-case queue probe. A CLOSED candidate never creates resources."""
import argparse
import dataclasses
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import time
from urllib.parse import urlsplit
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
NODE = '/opt/homebrew/opt/node@24/bin/node'
TEST_NAMES = (
    'skips more than a default batch of paused queues without rotating them and scans again after explicit resume',
    'keeps pause CAS authoritative when a candidate scan races promotion',
)
PATTERN = '^(' + '|'.join(TEST_NAMES) + ')$'


def read_json(path, limit):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > limit:
            raise ValueError('INVALID_INPUT_FILE')
        with os.fdopen(fd, 'rb', closefd=False) as source:
            data = source.read(limit + 1)
        after = os.fstat(fd)
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns) or len(data) > limit:
            raise ValueError('INPUT_CHANGED')
        return json.loads(data.decode('utf-8'))
    finally:
        os.close(fd)


def validate_permit(permit, now):
    if permit.get('state') != 'OPEN' or permit.get('reviewed') is not True:
        raise ValueError('PG_NOT_OPEN')
    if permit.get('totalSeconds') != 140 or permit.get('testNames') != list(TEST_NAMES):
        raise ValueError('PERMIT_SCOPE_MISMATCH')
    if not isinstance(permit.get('expiresEpoch'), (int, float)) or not math.isfinite(permit['expiresEpoch']) or permit['expiresEpoch'] - now < 140:
        raise ValueError('PERMIT_TIME_INSUFFICIENT')
    for name, length in [('head', 40), ('window', 32), ('inputSha256', 64)]:
        value = permit.get(name, '')
        if len(value) != length or any(c not in '0123456789abcdef' for c in value):
            raise ValueError('PERMIT_IDENTITY')
    if not isinstance(permit.get('requiredFreeBytes'), int) or permit['requiredFreeBytes'] <= 0:
        raise ValueError('FREE_FLOOR_REQUIRED')


def admin_input(value):
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in ('postgres', 'postgresql') or parsed.hostname not in ('127.0.0.1', 'localhost', '::1') or parsed.path != '/postgres' or '?' in value or '#' in value:
            raise ValueError()
        _ = parsed.port
    except (ValueError, TypeError):
        raise ValueError('LOCAL_ADMIN_REQUIRED') from None
    return value


def process_closed(report):
    first = report.get('first_failure')
    return (report.get('exit_code') is not None and report.get('owned_state') == 'absent'
            and report.get('capture') == 'merged' and report.get('eof') == {'stdout': True}
            and report.get('observed_bytes') == report.get('retained_bytes')
            and (first is None or first.get('code') == 'CHILD_EXIT_NONZERO')
            and not report.get('secondary_failures') and not report.get('signals'))


def selected_passed(result):
    if not isinstance(result, dict) or result.get('success') is not True:
        return False
    if result.get('numFailedTests', 0) != 0 or result.get('numFailedTestSuites', 0) != 0:
        return False
    suites = result.get('testResults')
    if not isinstance(suites, list) or not suites:
        return False
    selected = []
    for suite in suites:
        if not isinstance(suite, dict) or suite.get('status') != 'passed':
            return False
        assertions = suite.get('assertionResults')
        if not isinstance(assertions, list):
            return False
        for test in assertions:
            if not isinstance(test, dict) or test.get('status') not in ('passed', 'pending', 'skipped'):
                return False
            title, status = test.get('title'), test['status']
            if title in TEST_NAMES:
                if status != 'passed': return False
                selected.append(title)
            elif status == 'passed':
                return False
    return len(selected) == 2 and set(selected) == set(TEST_NAMES)


def sample_tree(root, deadline, max_bytes, max_entries=2048):
    before = root.lstat()
    if not stat.S_ISDIR(before.st_mode) or root.resolve() != root:
        raise ValueError('NAMESPACE_UNKNOWN')
    total, entries = 0, []
    def failed(error): raise error
    for directory, dirs, files in os.walk(root, followlinks=False, onerror=failed):
        for name in dirs + files:
            if time.monotonic() >= deadline: raise ValueError('STORAGE_DEADLINE')
            path = Path(directory) / name; item = path.lstat()
            if stat.S_ISLNK(item.st_mode) or not (stat.S_ISDIR(item.st_mode) or stat.S_ISREG(item.st_mode)):
                raise ValueError('NAMESPACE_UNKNOWN')
            if stat.S_ISREG(item.st_mode): total += item.st_size
            entries.append((path, item.st_dev, item.st_ino, stat.S_ISDIR(item.st_mode)))
            if total > max_bytes or len(entries) > max_entries: raise ValueError('STORAGE_LIMIT')
    after = root.lstat()
    if (before.st_dev, before.st_ino) != (after.st_dev, after.st_ino): raise ValueError('NAMESPACE_CHANGED')
    return {'bytes': total, 'entries': len(entries), 'identity': (before.st_dev, before.st_ino), 'items': entries}


def remove_sampled(root, sample, deadline):
    def check_root():
        if time.monotonic() >= deadline: raise ValueError('CLEANUP_DEADLINE')
        current = root.lstat()
        if not stat.S_ISDIR(current.st_mode) or stat.S_ISLNK(current.st_mode) or root.resolve() != root or (current.st_dev, current.st_ino) != sample['identity']:
            raise ValueError('NAMESPACE_CHANGED')
    # A replaced root must be rejected before touching any sampled child.
    check_root()
    for path, dev, ino, directory in sorted(sample['items'], key=lambda row: len(row[0].parts), reverse=True):
        check_root()
        current = path.lstat()
        if (current.st_dev, current.st_ino) != (dev, ino) or stat.S_ISLNK(current.st_mode): raise ValueError('NAMESPACE_CHANGED')
        check_root()
        if directory: path.rmdir()
        else: path.unlink()
    check_root()
    root.rmdir()
    try: root.lstat()
    except FileNotFoundError: return 'REMOVED_EXACT_ENOENT'
    raise ValueError('NAMESPACE_REMAINS')


def validate_admission(facts, permit, now, actual_head, branch, dirty):
    expected = {'claimId': 'a8a3b2d7-1bde-438a-9fbf-f81e1c791350', 'version': 1, 'state': 'ACTIVE',
                'taskId': 'S01Q01', 'worktree': str(ROOT), 'branch': 'codex/queue-paused-scan'}
    if any(facts.get(key) != value for key, value in expected.items()): raise ValueError('CLAIM_MISMATCH')
    age = now - facts.get('observedEpoch', 0)
    if not 0 <= age <= 60: raise ValueError('ADMISSION_STALE')
    if facts.get('head') != permit['head'] or actual_head != permit['head'] or branch != expected['branch'] or dirty or facts.get('clean') is not True: raise ValueError('HEAD_OR_DIRTY_MISMATCH')
    if facts.get('window') != permit['window'] or facts.get('windowGranted') is not True: raise ValueError('WINDOW_NOT_GRANTED')
    scopes = ['apps/server/src/conversation-queue/promotion.ts', 'apps/server/src/conversation-queue/queue.test.ts', 'docs/evidence/s01q01-paused-queue', 'plans/s01q01-paused-queue']
    if sorted(facts.get('scopes', [])) != sorted(scopes): raise ValueError('SCOPE_MISMATCH')
    terms = facts.get('resourceTerms', {})
    if not terms or any(type(value) is not int or value < 0 for value in terms.values()) or sum(terms.values()) != permit['requiredFreeBytes'] or facts.get('requiredFreeBytes') != permit['requiredFreeBytes']: raise ValueError('RESOURCE_SUM_MISMATCH')


def current_git():
    def read(*args):
        return subprocess.run(['/usr/bin/git', '-C', str(ROOT), *args], check=True, capture_output=True, text=True, timeout=2, env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'GIT_OPTIONAL_LOCKS': '0'}).stdout.strip()
    return read('rev-parse', 'HEAD'), read('branch', '--show-current'), read('status', '--porcelain', '--untracked-files=normal')


def write_new(path, value):
    data = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
    if len(data) > 262144: raise ValueError('RECEIPT_TOO_LARGE')
    with path.open('xb') as target:
        target.write(data); target.flush(); os.fsync(target.fileno())


def verify_inputs(inputs):
    for row in inputs['files']:
        path = Path(row['path'])
        if not path.is_absolute(): path = ROOT / path
        data = path.read_bytes()
        if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
            raise ValueError('INPUT_HASH_MISMATCH')
        if row.get('realpath') and str(path.resolve()) != row['realpath']:
            raise ValueError('INPUT_TARGET_MISMATCH')
    for row in inputs['aliases']:
        if str(Path(row['path']).resolve(strict=True)) != row['target']:
            raise ValueError('ALIAS_MISMATCH')


def run(permit_path):
    origin, start_ms = time.monotonic(), int(time.time() * 1000)
    permit = read_json(permit_path, 32768)
    validate_permit(permit, time.time())
    input_path = HERE / 'runtime-inputs.json'
    if hashlib.sha256(input_path.read_bytes()).hexdigest() != permit['inputSha256']:
        raise ValueError('INPUT_MANIFEST_MISMATCH')
    inputs = read_json(input_path, 262144)
    verify_inputs(inputs)
    # Actual admission files live outside the Git tree: they cannot dirty the source they attest.
    if not permit_path.is_absolute() or permit_path.resolve().is_relative_to(ROOT): raise ValueError('EXTERNAL_PERMIT_REQUIRED')
    admission = read_json(permit_path.with_name(permit_path.stem + '-admission.json'), 32768)
    validate_admission(admission, permit, time.time(), *current_git())
    admin = admin_input(os.environ.get('FLOW_S01Q01_TEST_ADMIN', ''))
    free = shutil.disk_usage(ROOT).free
    if free < permit['requiredFreeBytes']: raise ValueError('FREE_FLOOR')
    # Single exclusive record directory is the consumed-window marker, before any child.
    record_name = 'pg-run-' + permit['window']
    if permit.get('recordName') != record_name:
        raise ValueError('RECORD_NAME')
    record = HERE / record_name
    record.mkdir(mode=0o700)
    identity = record.lstat()
    scratch = record / 'tmp'; scratch.mkdir(mode=0o700)
    tmp_identity = scratch.lstat()
    write_new(record / 'owner.json', {'marker': uuid.uuid4().hex, 'dev': identity.st_dev, 'ino': identity.st_ino, 'window': permit['window'], 'head': permit['head'], 'startMs': start_ms, 'freeBytes': free})
    source = Path(inputs['supervisor'])
    spec = importlib.util.spec_from_file_location('s01q01_actual_ops14', source)
    ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
    argv = (NODE, str(HERE / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'queue.vitest.config.ts'), '--configLoader', 'runner', '--no-cache', '-t', PATTERN, '--reporter=json', '--outputFile', str(record / 'vitest.json'))
    env = {'PATH': '/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin', 'HOME': str(scratch), 'TMPDIR': str(scratch), 'XDG_CACHE_HOME': str(scratch), 'CI': '1', 'NO_COLOR': '1', 'FLOW_S01Q01_PG_OPEN': 'reviewed', 'FLOW_S01Q01_RECORD_ROOT': str(record), 'FLOW_S01Q01_START_MS': str(start_ms), 'FLOW_S01Q01_PG_HEAD': permit['head'], 'FLOW_S01Q01_PG_WINDOW': permit['window'], 'FLOW_S01Q01_TEST_ADMIN': admin}
    remaining = origin + 120 - time.monotonic()
    if remaining < 110: raise ValueError('STARTUP_BUDGET')
    report = ops.supervise(ops.Launch(argv, str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(remaining, 3, 7, 131072))
    with (record / 'raw.log').open('xb') as raw: raw.write(report.stdout)
    facts = dataclasses.asdict(report); facts.pop('stdout'); facts.pop('stderr')
    closed = process_closed(facts) and report.retained_bytes == len(report.stdout)
    # Preserve process facts before parsing any child result or resource receipt.
    write_new(record / 'process.json', facts)
    cleanup = None; passed = False; failures = []
    try:
        cleanup_files = list((record / 'queue').glob('*-cleanup.json'))
        if len(cleanup_files) != 1: raise ValueError('CLEANUP_RECEIPT_UNKNOWN')
        cleanup = read_json(cleanup_files[0], 16384)['facts']
        passed = selected_passed(read_json(record / 'vitest.json', 262144))
    except Exception as error:
        failures.append(type(error).__name__)
    resource_closed = closed and cleanup is not None and cleanup.get('cleanupConfirmed') is True and cleanup.get('state') == 'CLOSED'
    tmp_state = 'KEEP'; storage = None; tmp_sample = None; budget = False
    try:
        # Before deletion: both retained evidence and TMP count towards the envelope.
        combined = sample_tree(record, min(origin + 138, time.monotonic() + 2), 8 * 1024 * 1024 - 262144)
        tmp_sample = sample_tree(scratch, min(origin + 138, time.monotonic() + 2), 4 * 1024 * 1024, 1024)
        if tmp_sample['identity'] != (tmp_identity.st_dev, tmp_identity.st_ino): raise ValueError('TMP_IDENTITY')
        storage = combined['bytes']
        budget = storage - tmp_sample['bytes'] + 262144 <= 2 * 1024 * 1024
        if resource_closed and budget: tmp_state = remove_sampled(scratch, tmp_sample, origin + 138)
    except Exception as error: failures.append(type(error).__name__)
    outcome = {'testPassed': passed and report.exit_code == 0, 'resourceClosed': resource_closed, 'scratch': tmp_state, 'cleanup': cleanup, 'secondary': failures,
      'logicalBytesBeforeCleanup': storage, 'tmpBytesBeforeCleanup': tmp_sample['bytes'] if tmp_sample else None, 'tmpEntries': tmp_sample['entries'] if tmp_sample else None,
      'storageWithinBudget': budget, 'elapsedBeforeReceiptMs': round((time.monotonic() - origin) * 1000),
      'limitations': 'Bounded pre-cleanup sample, not live peak or OS quota. DB samples are not peaks; WAL reserve is planning only. No retry/extra probe/forced DROP.'}
    write_new(record / 'result.json', outcome)
    print(json.dumps({'record': str(record), 'testPassed': outcome['testPassed'], 'resourceClosed': resource_closed, 'scratch': tmp_state}), flush=True)
    return 0 if outcome['testPassed'] and resource_closed and tmp_state == 'REMOVED_EXACT_ENOENT' and budget and not failures and time.monotonic() <= origin + 140 else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--permit', required=True)
    arguments = parser.parse_args()
    try: sys.exit(run(Path(arguments.permit)))
    except Exception as error:
        # Do not render input values, connection URL or command environment.
        print(json.dumps({'state': 'FAILED_OR_UNKNOWN_KEEP', 'errorType': type(error).__name__}), flush=True)
        sys.exit(2)
