"""S01-only finite caller of the fixed OPS14 API. No PG, credential, or retry authority."""
import dataclasses
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

START = time.monotonic()
ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
NODE = '/opt/homebrew/opt/node@24/bin/node'
PYTHON = '/opt/homebrew/bin/python3.13'
OPS = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
OPS_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
WINDOW = 's01-observer-delivery-replay-once'
MODES = ('types', 'tests', 'caller', 'replay')

def utc():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def digest(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode):
            raise ValueError('input_not_regular')
        result = hashlib.sha256()
        while block := handle.read(1024 * 1024):
            result.update(block)
        return info.st_size, result.hexdigest()

def absent(path):
    try:
        path.lstat()
    except FileNotFoundError:
        return True
    return False

def save(path, value):
    data = json.dumps(value, separators=(',', ':')).encode()
    if len(data) > 65536:
        raise ValueError('receipt_limit')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as handle:
        handle.write(data); handle.flush(); os.fsync(handle.fileno())

def environment(tmp):
    return {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'UTC',
            'TMPDIR': str(tmp), 'TMP': str(tmp), 'TEMP': str(tmp),
            'NODE_DISABLE_COMPILE_CACHE': '1', 'TSX_DISABLE_CACHE': '1',
            'FLOW_S01_REPLAY_TMP': str(tmp / 'cache'),
            'TSX_TSCONFIG_PATH': str(ROOT / 'experiments/runner-capacity/mixed/tsconfig.json'),
            'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_TERMINAL_PROMPT': '0'}

def command(mode, trace_sha):
    if mode == 'caller':
        return [PYTHON, '-I', '-B', str(HERE / 'delivery-replay-operator.test.py')]
    if mode == 'types':
        return [NODE, str(ROOT / 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', str(HERE / 'delivery-replay-tsconfig.json')]
    if mode == 'tests':
        return [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'delivery-replay-vitest.config.mjs'), '--configLoader', 'native']
    return [NODE, '--import', 'tsx', str(ROOT / 'experiments/runner-capacity/mixed/delivery-replay-main.ts'),
            '--authorized-replay-once', str(HERE / 'delivery-replay-trace.json'), trace_sha]

def process_closed(report):
    return report.exit_code is not None and report.owned_state == 'absent' and bool(report.eof) and all(report.eof.values()) and not report.secondary_failures

def emit_result(record, end):
    print(json.dumps({'mode': record['mode'], 'successBeforePersistence': record['successBeforePersistence'], 'faults': record['faults']}), flush=True)
    return 0 if record['successBeforePersistence'] and time.monotonic() < end else 1

def inventory(root, identity, until, maximum_bytes):
    current = root.lstat()
    if not stat.S_ISDIR(current.st_mode) or (current.st_dev, current.st_ino) != identity:
        raise ValueError('tmp_identity')
    pending = [root]; count = 0; size = 0
    while pending:
        if time.monotonic() >= until:
            raise TimeoutError('inventory_deadline')
        with os.scandir(pending.pop()) as entries:
            for entry in entries:
                count += 1
                if count > 4096 or time.monotonic() >= until:
                    raise ValueError('inventory_limit')
                item = entry.stat(follow_symlinks=False)
                if stat.S_ISDIR(item.st_mode):
                    pending.append(Path(entry.path))
                elif stat.S_ISREG(item.st_mode):
                    size += item.st_size
                else:
                    raise ValueError('inventory_node')
                if size > maximum_bytes:
                    raise ValueError('inventory_bytes')
    current = root.lstat()
    if (current.st_dev, current.st_ino) != identity:
        raise ValueError('tmp_identity_after')
    return {'entries': count, 'logicalBytes': size, 'sampleOnlyNotPeak': True}

def child(mode, trace_sha):
    if not sys.flags.isolated or not sys.flags.dont_write_bytecode:
        raise ValueError('isolated_child_required')
    save(HERE / f'delivery-replay-{mode}-r1-spawn.json', {'pid': os.getpid(), 'pgid': os.getpgrp(), 'at': utc(), 'mode': mode})
    tmp = Path(os.environ['TMPDIR'])  # Parent supplies an explicit environment, never ambient copy.
    env = environment(tmp)
    if mode == 'replay':
        env['FLOW_S01_REPLAY_OPEN'] = WINDOW
    argv = command(mode, trace_sha)
    os.execve(argv[0], argv, env)

def main(mode, head, input_sha, floor):
    whole = 60 if mode == 'replay' else 40
    end = START + whole
    record = {'window': WINDOW, 'mode': mode, 'head': head, 'inputSha': input_sha, 'startedAt': utc(),
              'wholeLimitSeconds': whole, 'faults': [], 'wholeExternalWall': None, 'activePeakBytes': None}
    tmp = None; identity = None; report = None; output = HERE / f'delivery-replay-{mode}-r1'
    if not sys.flags.isolated or not sys.flags.dont_write_bytecode or mode not in MODES:
        raise ValueError('fixed_isolated_entry_required')
    if os.environ.get('FLOW_S01_REPLAY_OPEN') != WINDOW + ':' + mode:
        raise ValueError('separate_named_open_required')
    if not all(absent(Path(str(output) + suffix)) for suffix in ('-reservation.json', '-spawn.json', '-root.json', '.raw', '.json')):
        raise ValueError('output_exists')
    if digest(HERE / 'delivery-replay-input.json')[1] != input_sha:
        raise ValueError('input_hash')
    inputs = json.loads((HERE / 'delivery-replay-input.json').read_text())
    for row in inputs['files']:
        path = Path(row['path']) if row['path'].startswith('/') else ROOT / row['path']
        if digest(path.resolve()) != (row['bytes'], row['sha256']):
            raise ValueError('fixed_input_changed')
        if row.get('realpath') and str(path.resolve()) != row['realpath']:
            raise ValueError('dependency_target_changed')
    for args, expected in ((['rev-parse', 'HEAD'], head), (['status', '--porcelain'], '')):
        actual = subprocess.check_output(['/usr/bin/git', *args], cwd=ROOT, env=environment(Path('/tmp')), timeout=3).decode().strip()
        if actual != expected:
            raise ValueError('execution_git_identity')
    vfs = os.statvfs(ROOT); record['freeBytes'] = vfs.f_bavail * vfs.f_frsize; record['floorBytes'] = floor
    if floor < inputs['minimumHistoricalFloorNotAuthorization'] or record['freeBytes'] < floor or time.monotonic() >= START + 5:
        raise ValueError('fresh_floor_or_preparation_deadline')
    save(Path(str(output) + '-reservation.json'), record)
    try:
        tmp = Path(tempfile.mkdtemp(prefix='flow-s01-delivery-replay-', dir='/tmp')); info = tmp.lstat(); identity = (info.st_dev, info.st_ino)
        record['tmp'] = {'path': str(tmp), 'dev': identity[0], 'ino': identity[1], 'removed': False}
        # Persist ownership before starting any owned child.
        save(Path(str(output) + '-root.json'), record['tmp'])
        if digest(OPS)[1] != OPS_SHA:
            raise ValueError('supervisor_hash')
        spec = importlib.util.spec_from_file_location('s01_replay_owned', OPS)
        owned = importlib.util.module_from_spec(spec); sys.modules[spec.name] = owned; spec.loader.exec_module(owned)
        work = min(45 if mode == 'replay' else 30, end - time.monotonic() - 10)
        if work <= 0:
            raise TimeoutError('no_work_budget')
        argv = (PYTHON, '-I', '-B', str(Path(__file__).resolve()), '--child', mode, inputs['traceSha256'])
        capture = 128 * 1024 if mode == 'replay' else 32 * 1024
        report = owned.supervise(owned.Launch(argv, str(ROOT), environment(tmp), owned.Ownership.NEW_CHILD_SESSION, owned.Capture.MERGED),
                                 owned.Policy(work, 2, 3, capture))
        record['process'] = {key: value for key, value in dataclasses.asdict(report).items() if key not in ('stdout', 'stderr')}
        raw = report.stdout
        fd = os.open(str(output) + '.raw', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as handle:
            handle.write(raw); handle.flush(); os.fsync(handle.fileno())
        record['raw'] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
        closed = process_closed(report)
        record['closed'] = closed
        if report.exit_code != 0 or report.first_failure or not closed:
            record['faults'].append('process_or_execution_failed_or_unknown')
        if closed and time.monotonic() < end - 5:
            record['tmp']['lastSample'] = inventory(tmp, identity, end - 4, (8 if mode == 'replay' else 2) * 1024 * 1024)
            if time.monotonic() >= end - 3:
                raise TimeoutError('no_delete_budget')
            shutil.rmtree(tmp)
            record['tmp']['removed'] = absent(tmp)
        else:
            record['faults'].append('tmp_keep_unknown_or_late')
    except Exception as error:
        record['faults'].append(type(error).__name__)
    record['beforePersistenceMs'] = (time.monotonic() - START) * 1000
    record['successBeforePersistence'] = not record['faults'] and record.get('tmp', {}).get('removed') is True and time.monotonic() < end - 1
    save(Path(str(output) + '.json'), record)
    return emit_result(record, end)

if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--child' and sys.argv[2] in MODES:
        child(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 5 and sys.argv[1] in MODES:
        raise SystemExit(main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])))
    else:
        raise SystemExit('fixed_arguments_required')
