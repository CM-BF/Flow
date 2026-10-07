"""S01-only caller of OPS14; source preparation, never an implicit OPEN."""
import dataclasses
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from datetime import datetime, timezone

STARTED = time.monotonic()
ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
WINDOW = 's01-pool-wait-delivery-once'
NODE = '/opt/homebrew/opt/node@24/bin/node'
PYTHON = '/opt/homebrew/bin/python3.13'
GIT = '/usr/bin/git'
OPS = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
OPS_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
OUTPUT = ROOT / 'docs/evidence/s01/pool-wait-run'


def now():
    return datetime.now(timezone.utc).isoformat()


def save(path, value):
    data = json.dumps(value, separators=(',', ':')).encode()
    if len(data) > 65536:
        raise ValueError('caller_receipt_limit')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def base_environment():
    # Fixed non-secret inputs; no ambient HOME, hooks, loader options, proxies or PG defaults.
    return {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'UTC', 'TMPDIR': '/tmp',
            'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_TERMINAL_PROMPT': '0',
            'NODE_DISABLE_COMPILE_CACHE': '1', 'TSX_DISABLE_CACHE': '1', 'PYTHONDONTWRITEBYTECODE': '1',
            'TSX_TSCONFIG_PATH': str(ROOT / 'experiments/runner-capacity/mixed/tsconfig.json')}


def runtime_environment(admin_url):
    if not isinstance(admin_url, str) or not admin_url or '\0' in admin_url:
        raise ValueError('explicit_admin_required')
    return {**base_environment(), 'FLOW_S01_ADMIN_URL': admin_url}


def authorized_environment(environment):
    if environment.get('FLOW_S01_QUEUE_OPEN') != WINDOW:
        raise ValueError('named_open_required')
    return runtime_environment(environment.get('FLOW_S01_ADMIN_URL'))


def git(*args):
    return subprocess.check_output([GIT, *args], cwd=ROOT, env=base_environment(),
                                  timeout=3, stderr=subprocess.DEVNULL).decode().strip()


def digest(path):
    result = hashlib.sha256()
    with open(path, 'rb') as handle:
        while chunk := handle.read(1024 * 1024):
            result.update(chunk)
    return result.hexdigest()


def child(target, floor):
    if not sys.flags.isolated or not sys.flags.dont_write_bytecode:
        raise ValueError('isolated_python_required')
    # Checkpoint blocks inside the supervised lifetime; exec preserves its PID/group.
    save(HERE / 'queue-actual-spawn.json', {'window': WINDOW, 'target': target, 'pid': os.getpid(),
         'pgid': os.getpgrp(), 'at': now(), 'exec': 'node queue-main.ts'})
    os.execve(NODE, [NODE, '--import', 'tsx', 'experiments/runner-capacity/mixed/queue-main.ts', WINDOW, target, floor],
              runtime_environment(os.environ.get('FLOW_S01_ADMIN_URL')))


def main(target, expected_input_sha, floor_text):
    record = {'window': WINDOW, 'target': target, 'startedAt': now(), 'spawned': False,
              'fault': None, 'resources': 'UNKNOWN', 'automaticVerdict': 'NOT_RUN'}
    try:
        if not sys.flags.isolated or not sys.flags.dont_write_bytecode:
            raise ValueError('isolated_python_required')
        env = authorized_environment(os.environ)
        if len(target) != 40 or git('rev-parse', 'HEAD') != target or git('status', '--porcelain'):
            raise ValueError('clean_execution_head_required')
        input_path = HERE / 'queue-operator-input-v2.json'
        if digest(input_path) != expected_input_sha:
            raise ValueError('input_identity')
        inputs = json.loads(input_path.read_text())
        floor = int(floor_text)
        if floor < inputs['minimumCandidateFloorBytes']:
            raise ValueError('resource_sum_missing')
        for binding in inputs['files']:
            file = ROOT / binding['path']
            if file.stat().st_size != binding['bytes'] or digest(file) != binding['sha256']:
                raise ValueError('fixed_input_changed')
        if digest(OPS) != OPS_SHA:
            raise ValueError('supervisor_changed')
        for file in [OUTPUT, *(HERE / name for name in inputs['callerOutputs'])]:
            try:
                file.lstat()
            except FileNotFoundError:
                continue
            raise ValueError('planned_output_exists')
        disk = os.statvfs(ROOT)
        record['freshFreeBytes'] = disk.f_bavail * disk.f_frsize
        record['floorBytes'] = floor
        if record['freshFreeBytes'] < floor:
            raise ValueError('resource_floor')
        if time.monotonic() - STARTED > 5:
            raise ValueError('caller_preflight_deadline')
        # Fresh claim/holder/cluster-WAL checks remain the explicit named OPEN operator preflight.
        save(HERE / 'queue-actual-reservation.json', {**record, 'inputSha256': expected_input_sha})
        spec = importlib.util.spec_from_file_location('s01_queue_ops14', OPS)
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        # 295 seconds absolute work, 2 seconds bounded stop/drain, 3 seconds final persistence.
        work = STARTED + 295 - time.monotonic()
        if work <= 0:
            raise ValueError('caller_no_work_remaining')
        record['launchRequested'] = True
        record['automaticVerdict'] = 'FAIL_OR_UNKNOWN'
        report = module.supervise(module.Launch((PYTHON, '-I', '-B', str(Path(__file__).resolve()),
            '--supervised-child', target, floor_text), str(ROOT), env,
            module.Ownership.NEW_CHILD_SESSION, module.Capture.SEPARATE), module.Policy(work, 1, 1, 262144))
        record['spawned'] = report.pid is not None
        record['process'] = {key: value for key, value in dataclasses.asdict(report).items() if key not in ('stdout', 'stderr')}
        for name, data in [('queue-actual-stdout.raw', report.stdout), ('queue-actual-stderr.raw', report.stderr)]:
            with os.fdopen(os.open(HERE / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'wb') as handle:
                handle.write(data)
            record.setdefault('raw', []).append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        closed = report.owned_state == 'absent' and all(report.eof.values()) and report.first_failure is None and not report.secondary_failures
        record['processClosed'] = closed
        # Preserve original Node receipt and every resource identity; caller never drops DBs or removes TMP.
        result = json.loads(report.stdout)
        record['entryResult'] = result
        confirmed = (closed and report.exit_code == 0 and result['windowId'] == WINDOW and result['target'] == target
                     and result['success'] is True and not result['errors'] and result['cleanup']['removed'] is True
                     and len(result['outcomes']) == 2 and all(row['state'] == 'PASS' and row['receipt']['resourcesClosed'] is True for row in result['outcomes']))
        record['resources'] = 'ENTRY_CONFIRMED_CLOSED' if confirmed else 'UNKNOWN_RETAIN'
        record['automaticVerdict'] = 'PASS' if confirmed else 'FAIL_OR_UNKNOWN'
    except Exception as error:
        record['fault'] = {'type': type(error).__name__, 'errno': getattr(error, 'errno', None)}
    record['beforeFinalPersistenceMs'] = (time.monotonic() - STARTED) * 1000
    record['endedAt'] = now()
    if time.monotonic() >= STARTED + 299:
        record['automaticVerdict'] = 'FAIL_OR_UNKNOWN'
    save(HERE / 'queue-actual-outer.json', record)
    return emit_result(record)


def emit_result(record):
    # Receipt/CLI are pre-delivery snapshots; a blocked flush cannot make the real exit a late PASS.
    finished = time.monotonic() - STARTED
    print(json.dumps({'window': WINDOW, 'verdict': record['automaticVerdict'],
                      'persistedElapsedMs': finished * 1000}), flush=True)
    return 0 if record['automaticVerdict'] == 'PASS' and time.monotonic() < STARTED + 300 else 1


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--supervised-child':
        child(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 4:
        sys.exit(main(*sys.argv[1:]))
    else:
        raise SystemExit('Expected explicit execution HEAD, fixed input SHA and complete fresh floor.')
