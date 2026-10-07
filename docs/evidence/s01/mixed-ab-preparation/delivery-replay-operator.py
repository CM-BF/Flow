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
from types import SimpleNamespace
from datetime import datetime, timezone

START = time.monotonic()
ROOT = Path(__file__).resolve().parents[4]
EXPECTED_ROOT = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe')
BRANCH = 'codex/runner-capacity-probe'
HERE = Path(__file__).resolve().parent
NODE = '/opt/homebrew/opt/node@24/bin/node'
PYTHON = '/opt/homebrew/bin/python3.13'
OPS = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
OPS_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
WINDOW = 's01-observer-delivery-replay-once'
MODES = ('caller', 'compile', 'tests', 'replay')
INPUT = HERE / 'delivery-replay-input-v2.json'
BUILD = HERE / 'delivery-replay-js-v2'
JS_NAMES = ('delivery-replay-main.js', 'delivery-replay.js', 'pg-delivery-bridge.js', 'pg-delivery.js', 'channel.js', 'contract.js')
SUFFIXES = ('-reservation.json', '-spawn.json', '-root.json', '.raw', '.json')

def output_base(mode):
    return HERE / f'delivery-replay-v2-{mode}-r1'

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
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)

def environment(tmp):
    return {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'UTC',
            'TMPDIR': str(tmp), 'TMP': str(tmp), 'TEMP': str(tmp),
            'NODE_DISABLE_COMPILE_CACHE': '1', 'TSX_DISABLE_CACHE': '1',
            'FLOW_S01_REPLAY_TMP': str(tmp / 'cache'),
            'TSX_TSCONFIG_PATH': str(ROOT / 'experiments/runner-capacity/mixed/tsconfig.json'),
            'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_TERMINAL_PROMPT': '0'}

def command(mode, trace_sha, tmp):
    if mode == 'caller':
        return [PYTHON, '-I', '-B', str(HERE / 'delivery-replay-operator.test.py')]
    if mode == 'compile':
        return [NODE, str(ROOT / 'node_modules/typescript/bin/tsc'), '-p', str(HERE / 'delivery-replay-emit-tsconfig.json'), '--outDir', str(tmp / 'emit')]
    if mode == 'tests':
        return [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'delivery-replay-vitest.config.mjs'), '--configLoader', 'native']
    return [NODE, str(BUILD / 'delivery-replay-main.js'),
            '--authorized-replay-once', str(HERE / 'delivery-replay-trace.json'), trace_sha]

def process_closed(report, saved_raw):
    first = report.first_failure
    return (report.exit_code is not None and report.owned_state == 'absent'
            and report.capture == 'merged' and report.eof == {'stdout': True}
            and report.observed_bytes == report.retained_bytes == len(saved_raw)
            and report.stdout == saved_raw and report.stderr == b''
            and not report.secondary_failures
            and (first is None or first.get('code') == 'CHILD_EXIT_NONZERO')
            and all(item.get('state') in ('sent', 'absent') for item in report.signals))

def read_bytes(path, maximum):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
            raise ValueError('receipt_file')
        data = handle.read(maximum + 1)
        if len(data) != info.st_size or len(data) > maximum:
            raise ValueError('receipt_changed_or_oversize')
        return data

def read_json(path, maximum=65536):
    return json.loads(read_bytes(path, maximum))

def build_binding(input_sha, expected_sha):
    if not stat.S_ISDIR(BUILD.lstat().st_mode):
        raise ValueError('build_identity')
    if digest(BUILD / 'manifest.json')[1] != expected_sha:
        raise ValueError('build_manifest_hash')
    value = read_json(BUILD / 'manifest.json')
    if value['inputSha'] != input_sha or value['runtimeFiles'] != list(JS_NAMES):
        raise ValueError('build_input_identity')
    expected = set(JS_NAMES) | {'package.json', 'manifest.json'}
    with os.scandir(BUILD) as entries:
        for entry in entries:
            if entry.name not in expected:
                raise ValueError('build_extra')
            expected.remove(entry.name)
    if expected or set(value['files']) != set(JS_NAMES) | {'package.json'}:
        raise ValueError('build_missing')
    total = 0
    for name, row in value['files'].items():
        size, sha = digest(BUILD / name); total += size
        if (size, sha) != (row['bytes'], row['sha256']):
            raise ValueError('build_file_hash')
    if total > 128 * 1024 or read_json(BUILD / 'package.json') != {'type': 'module'}:
        raise ValueError('build_bound_or_esm')
    compile_base = output_base('compile')
    receipt = read_json(Path(str(compile_base) + '.json'))
    raw = read_bytes(Path(str(compile_base) + '.raw'), 32 * 1024)
    facts = SimpleNamespace(**receipt['process'], stdout=raw, stderr=b'')
    if (receipt.get('window') != WINDOW or receipt.get('mode') != 'compile'
            or receipt.get('inputSha') != input_sha or receipt.get('head') != value['compilerExecutionHead']
            or receipt.get('build', {}).get('manifestSha') != expected_sha
            or receipt.get('successBeforePersistence') is not True or receipt.get('faults') != []
            or receipt.get('tmp', {}).get('removed') is not True
            or receipt.get('raw') != {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
            or not process_closed(facts, raw) or facts.exit_code != 0 or facts.first_failure is not None):
        raise ValueError('build_compile_receipt_unknown')
    return value

def publish_build(tmp, inputs, input_sha, head, argv):
    if not absent(BUILD):
        raise ValueError('build_exists')
    if not stat.S_ISDIR((tmp / 'emit').lstat().st_mode):
        raise ValueError('emit_directory_identity')
    data = {}
    for name in JS_NAMES:
        path = tmp / 'emit' / name
        data[name] = read_bytes(path, 64 * 1024)
    data['package.json'] = b'{"type":"module"}\n'
    if sum(map(len, data.values())) > 128 * 1024:
        raise ValueError('emitted_total_limit')
    BUILD.mkdir()
    for name, payload in data.items():
        fd = os.open(BUILD / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as handle:
            handle.write(payload); handle.flush(); os.fsync(handle.fileno())
    runtime_sources = {'experiments/runner-capacity/mixed/' + name[:-3] + '.ts' for name in JS_NAMES}
    value = {'inputSha': input_sha, 'compilerExecutionHead': head, 'compilerArgv': argv, 'runtimeFiles': list(JS_NAMES),
             'sourceBindings': [row for row in inputs['files'] if row['path'] in runtime_sources],
             'compilerBindings': [row for row in inputs['files'] if row['path'].startswith('node_modules/typescript/') or '/node@24/' in row['path']],
             'files': {name: {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()} for name, payload in data.items()},
             'at': utc(), 'method': 'fixed tsc strict/noEmitOnError; only six runtime leaves retained; test/type-only JS discarded with owned TMP'}
    save(BUILD / 'manifest.json', value)
    return {'manifestSha': digest(BUILD / 'manifest.json')[1], 'bytes': sum(map(len, data.values()))}

def allowed_dirty(status, permitted):
    for entry in status.split('\0'):
        if entry and (not entry.startswith('?? ') or entry[3:] not in permitted):
            return False
    return True

def prior_outputs(mode, head, input_sha):
    previous = {'caller': (), 'compile': ('caller',), 'tests': ('caller', 'compile'), 'replay': ()}[mode]
    permitted = set(); bindings = {}
    for prior in previous:
        base = output_base(prior)
        receipt = read_json(Path(str(base) + '.json'))
        if (receipt.get('window'), receipt.get('mode'), receipt.get('head'), receipt.get('inputSha'), receipt.get('successBeforePersistence')) != (WINDOW, prior, head, input_sha, True):
            raise ValueError('prior_receipt_identity_or_failure')
        raw_path = Path(str(base) + '.raw'); raw_size, raw_sha = digest(raw_path)
        if receipt.get('raw') != {'bytes': raw_size, 'sha256': raw_sha} or not receipt.get('closed') or receipt.get('tmp', {}).get('removed') is not True:
            raise ValueError('prior_receipt_incomplete')
        raw = read_bytes(raw_path, 32 * 1024)
        facts = SimpleNamespace(**receipt['process'], stdout=raw, stderr=b'')
        if not process_closed(facts, raw) or facts.exit_code != 0 or facts.first_failure is not None or receipt.get('faults') != []:
            raise ValueError('prior_process_not_successfully_closed')
        reservation = read_json(Path(str(base) + '-reservation.json'))
        spawn = read_json(Path(str(base) + '-spawn.json'))
        root = read_json(Path(str(base) + '-root.json'))
        if (any(reservation.get(k) != receipt.get(k) for k in ('window', 'mode', 'head', 'inputSha'))
                or spawn.get('pid') != receipt['process']['pid'] or spawn.get('pgid') != spawn.get('pid') or spawn.get('mode') != prior
                or any(root.get(k) != receipt['tmp'].get(k) for k in ('path', 'dev', 'ino'))):
            raise ValueError('prior_resource_binding')
        for suffix in SUFFIXES:
            path = Path(str(base) + suffix); relative = str(path.relative_to(ROOT)); permitted.add(relative)
            size, sha = digest(path); bindings[relative] = {'bytes': size, 'sha256': sha}
        if prior == 'compile':
            build_binding(input_sha, receipt['build']['manifestSha'])
            for name in (*JS_NAMES, 'package.json', 'manifest.json'):
                path = BUILD / name; relative = str(path.relative_to(ROOT)); permitted.add(relative)
                size, sha = digest(path); bindings[relative] = {'bytes': size, 'sha256': sha}
    return permitted, bindings

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
    save(Path(str(output_base(mode)) + '-spawn.json'), {'pid': os.getpid(), 'pgid': os.getpgrp(), 'at': utc(), 'mode': mode})
    tmp = Path(os.environ['TMPDIR'])  # Parent supplies an explicit environment, never ambient copy.
    env = environment(tmp)
    if mode == 'replay':
        env['FLOW_S01_REPLAY_OPEN'] = WINDOW
    argv = command(mode, trace_sha, tmp)
    os.execve(argv[0], argv, env)

def main(mode, head, input_sha, floor, build_sha):
    whole = 60 if mode == 'replay' else 40
    end = START + whole
    record = {'window': WINDOW, 'mode': mode, 'head': head, 'inputSha': input_sha, 'startedAt': utc(),
              'wholeLimitSeconds': whole, 'faults': [], 'wholeExternalWall': None, 'activePeakBytes': None}
    tmp = None; identity = None; report = None; output = output_base(mode)
    if ROOT != EXPECTED_ROOT or not sys.flags.isolated or not sys.flags.dont_write_bytecode or mode not in MODES:
        raise ValueError('fixed_isolated_entry_required')
    if os.environ.get('FLOW_S01_REPLAY_OPEN') != WINDOW + ':' + mode:
        raise ValueError('separate_named_open_required')
    if not all(absent(Path(str(output) + suffix)) for suffix in SUFFIXES):
        raise ValueError('output_exists')
    if digest(INPUT)[1] != input_sha:
        raise ValueError('input_hash')
    inputs = read_json(INPUT)
    for row in inputs['files']:
        path = Path(row['path']) if row['path'].startswith('/') else ROOT / row['path']
        if digest(path.resolve()) != (row['bytes'], row['sha256']):
            raise ValueError('fixed_input_changed')
        if row.get('realpath') and str(path.resolve()) != row['realpath']:
            raise ValueError('dependency_target_changed')
    for args, expected in ((['rev-parse', 'HEAD'], head), (['rev-parse', 'origin/' + BRANCH], head),
                           (['branch', '--show-current'], BRANCH)):
        actual = subprocess.check_output(['/usr/bin/git', *args], cwd=ROOT, env=environment(Path('/tmp')), timeout=3).decode().strip()
        if actual != expected:
            raise ValueError('execution_git_identity')
    permitted, record['priorOutputs'] = prior_outputs(mode, head, input_sha)
    dirty = subprocess.check_output(['/usr/bin/git', 'status', '--porcelain=v1', '--untracked-files=all', '-z'], cwd=ROOT, env=environment(Path('/tmp')), timeout=3).decode()
    if not allowed_dirty(dirty, permitted):
        raise ValueError('unknown_dirty')
    if mode == 'compile' and not absent(BUILD):
        raise ValueError('build_already_present')
    if mode == 'replay':
        record['compiledInput'] = build_binding(input_sha, build_sha)
    elif build_sha != '-':
        raise ValueError('unexpected_build_argument')
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
        closed = process_closed(report, raw)
        record['closed'] = closed
        if report.exit_code != 0 or report.first_failure or not closed:
            record['faults'].append('process_or_execution_failed_or_unknown')
        if mode == 'compile' and not record['faults'] and time.monotonic() < end - 6:
            record['build'] = publish_build(tmp, inputs, input_sha, head, command(mode, inputs['traceSha256'], tmp))
        elif mode == 'compile':
            record['faults'].append('compile_not_published')
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
    elif len(sys.argv) == 6 and sys.argv[1] in MODES:
        raise SystemExit(main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]))
    else:
        raise SystemExit('fixed_arguments_required')
