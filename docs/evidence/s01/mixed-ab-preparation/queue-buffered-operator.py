"""One explicit buffered arm. Reuses frozen queue helpers and OPS14; no deletion authority."""
import dataclasses
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

STARTED = time.monotonic()
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
WINDOW = 's01-queue-buffered-once'
ENTRY = 'experiments/runner-capacity/mixed/queue-buffered-main.ts'
OUTPUT = ROOT / 'docs/evidence/s01/pool-wait-run/buffered-single-v1'
INPUT = HERE / 'queue-buffered-operator-input.json'
NAMES = tuple('queue-buffered-actual-' + tail for tail in ('reservation.json', 'spawn.json', 'stdout.raw', 'stderr.raw', 'outer.json'))
HELPER_SHA = '51457f70cd90b27815b348f6b43c21b332498593891d0a9683036c8d894bf825'

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module

if hashlib.sha256((HERE / 'queue-operator.py').read_bytes()).hexdigest() != HELPER_SHA:
    raise ValueError('frozen_helper_changed')
helper = load('s01_frozen_queue_helpers', HERE / 'queue-operator.py')

def authorized(environment):
    if environment.get('FLOW_S01_QUEUE_OPEN') != WINDOW:
        raise ValueError('named_open_required')
    return helper.runtime_environment(environment.get('FLOW_S01_ADMIN_URL'))

def process_closed(report):
    return (report.exit_code == 0 and report.owned_state == 'absent' and report.capture == 'separate'
            and report.eof == {'stdout': True, 'stderr': True} and report.first_failure is None
            and not report.secondary_failures and all(x.get('state') in ('sent', 'absent') for x in report.signals)
            and report.observed_bytes == report.retained_bytes == len(report.stdout) + len(report.stderr))

def confirmed(result, target):
    if not isinstance(result, dict): return False
    rows = result.get('outcomes')
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict): return False
    row = rows[0]; receipt = row.get('receipt'); cleanup = result.get('cleanup')
    return (result.get('windowId') == WINDOW and result.get('target') == target and result.get('success') is True
            and result.get('errors') == [] and isinstance(cleanup, dict) and cleanup.get('removed') is True
            and cleanup.get('retained') is False and row.get('side') == 'A' and row.get('state') == 'PASS'
            and isinstance(receipt, dict) and receipt.get('success') is True and receipt.get('resourcesClosed') is True
            and receipt.get('tasksSentOrUnknown') == result.get('tasksSentOrUnknown') == 129)

def child(target, floor):
    if not sys.flags.isolated or not sys.flags.dont_write_bytecode: raise ValueError('isolated_python_required')
    helper.save(HERE / NAMES[1], {'window': WINDOW, 'target': target, 'pid': os.getpid(), 'pgid': os.getpgrp(),
                                'at': helper.now(), 'exec': ENTRY})
    os.execve(helper.NODE, [helper.NODE, '--import', 'tsx', ENTRY, WINDOW, target, floor],
              helper.runtime_environment(os.environ.get('FLOW_S01_ADMIN_URL')))

def emit_result(record):
    print(json.dumps({'window': WINDOW, 'verdict': record['automaticVerdict'],
                      'persistedElapsedMs': (time.monotonic() - STARTED) * 1000}), flush=True)
    return 0 if record['automaticVerdict'] == 'PASS' and time.monotonic() < STARTED + 300 else 1

def main(target, input_sha, floor_text):
    record = {'window': WINDOW, 'target': target, 'startedAt': helper.now(), 'spawned': False,
              'fault': None, 'resources': 'UNKNOWN', 'automaticVerdict': 'NOT_RUN'}
    try:
        if not sys.flags.isolated or not sys.flags.dont_write_bytecode: raise ValueError('isolated_python_required')
        env = authorized(os.environ)
        if len(target) != 40 or helper.git('rev-parse', 'HEAD') != target or helper.git('status', '--porcelain'):
            raise ValueError('clean_execution_head_required')
        if helper.digest(INPUT) != input_sha: raise ValueError('input_identity')
        inputs = json.loads(INPUT.read_text()); floor = int(floor_text)
        if (inputs['windowId'] != WINDOW or inputs['callerOutputs'] != list(NAMES)
                or inputs['experimentOutputRoot'] != str(OUTPUT.relative_to(ROOT))): raise ValueError('fixed_variant')
        if floor < inputs['minimumCandidateFloorBytes']: raise ValueError('resource_sum_missing')
        for binding in inputs['files']:
            file = ROOT / binding['path']
            if str(file.resolve()) != binding['realpath'] or file.stat().st_size != binding['bytes'] or helper.digest(file) != binding['sha256']:
                raise ValueError('fixed_input_changed')
        if helper.digest(helper.OPS) != helper.OPS_SHA: raise ValueError('supervisor_changed')
        for file in [OUTPUT, *(HERE / name for name in NAMES)]:
            try: file.lstat()
            except FileNotFoundError: continue
            raise ValueError('planned_output_exists')
        disk = os.statvfs(ROOT); record['freshFreeBytes'] = disk.f_bavail * disk.f_frsize; record['floorBytes'] = floor
        if record['freshFreeBytes'] < floor: raise ValueError('resource_floor')
        if time.monotonic() - STARTED > 5: raise ValueError('caller_preflight_deadline')
        helper.save(HERE / NAMES[0], {**record, 'inputSha256': input_sha})
        owned = load('s01_buffered_ops14', helper.OPS)
        work = STARTED + 295 - time.monotonic()
        if work <= 0: raise ValueError('caller_no_work_remaining')
        record['automaticVerdict'] = 'FAIL_OR_UNKNOWN'; record['launchRequested'] = True
        report = owned.supervise(owned.Launch((helper.PYTHON, '-I', '-B', str(Path(__file__).resolve()),
            '--supervised-child', target, floor_text), str(ROOT), env, owned.Ownership.NEW_CHILD_SESSION,
            owned.Capture.SEPARATE), owned.Policy(work, 1, 1, 262144))
        record['spawned'] = report.pid is not None
        record['process'] = {k: v for k, v in dataclasses.asdict(report).items() if k not in ('stdout', 'stderr')}
        for name, data in zip(NAMES[2:4], (report.stdout, report.stderr)):
            with os.fdopen(os.open(HERE / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'wb') as handle:
                handle.write(data); handle.flush(); os.fsync(handle.fileno())
            record.setdefault('raw', []).append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        record['processClosed'] = process_closed(report)
        result = json.loads(report.stdout); record['entryResult'] = result
        known = record['processClosed'] and confirmed(result, target)
        record['resources'] = 'ENTRY_CONFIRMED_CLOSED' if known else 'UNKNOWN_RETAIN'
        record['automaticVerdict'] = 'PASS' if known else 'FAIL_OR_UNKNOWN'
    except Exception as error:
        record['fault'] = {'type': type(error).__name__, 'errno': getattr(error, 'errno', None)}
    record['beforeFinalPersistenceMs'] = (time.monotonic() - STARTED) * 1000; record['endedAt'] = helper.now()
    if time.monotonic() >= STARTED + 299: record['automaticVerdict'] = 'FAIL_OR_UNKNOWN'
    helper.save(HERE / NAMES[4], record)
    return emit_result(record)

if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--supervised-child': child(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 4: sys.exit(main(*sys.argv[1:]))
    else: raise SystemExit('Expected fixed HEAD, input SHA and fresh complete floor; separate named OPEN required.')
