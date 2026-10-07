"""Thin fixed phase assembly; existing continuation/OPS14 own deadlines and child cleanup."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
BASE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/update-diagnostics-candidate')
NODE = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
PYTHON = '/opt/homebrew/Cellar/python@3.13/3.13.3_1/Frameworks/Python.framework/Versions/3.13/bin/python3.13'
PHASES = ['fresh', 'rebind', 'refresh', 'checkpoint', 'resume', 'final']
WINDOW = 'svc06-personal-held23-e15-continuation-once'

def pin(binding):
    path = Path(binding['path']); info = path.lstat()
    assert path.is_file() and not path.is_symlink() and str(path.resolve()) == binding['realpath']
    data = path.read_bytes()
    assert len(data) == binding['bytes'] and hashlib.sha256(data).hexdigest() == binding['sha256']
    after = path.lstat()
    assert (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns) == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
    return data

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module

def compile_plan(value, input_path, digest, wall_deadline):
    assert value['ready'] is True, 'FRESH_FACTS_AND_FOUR_REPORTS_REQUIRED'
    assert value['purpose'] == 'SVC06B_SAME_HELD_OPERATION_CONTINUATION'
    assert value['phases'] == PHASES
    assert value['runDirectory'] == '/private/tmp/flow-svc06-held-recovery-e15-continuation-20261007-once'
    assert len(value['reports']) == 4 and value['publishNewWeb'] is False and value['providerQueries'] == 0
    assert value['operationId'] == '35d5a7ff-5ef7-4938-9584-adb27f5357ff' and value['version'] == 23
    assert Path(input_path).is_absolute() and len(digest) == 64
    steps = []
    for phase in PHASES:
        artifact = value['migration']['expectedBackendArtifact'] if phase in PHASES[:2] else value['migration']['artifact']
        root = Path(value['migration']['installationDirectory']) / 'backend-artifacts' / artifact['artifactId'] / 'root'
        steps.append({'name': phase, 'argv': [NODE, '--import', str(root / 'node_modules/tsx/dist/loader.mjs'),
            str(HERE / 'caller.mjs'), '--phase', phase, str(input_path), digest, str(wall_deadline)],
            'cwd': str(root), 'ownership': 'childPidOnly', 'maximumWorkSeconds': 180 if phase == 'refresh' else 60})
    budget = value['migration']['budget']
    return {'steps': steps, 'node': NODE, 'directory': value['migration']['installationDirectory'],
        'runDirectory': value['runDirectory'], 'planPath': str(input_path),
        'budget': {'freshBytes': budget['freshBytes'], 'liveBytes': budget['liveBytes'], 'rawBytes': budget['rawBytes'], 'perPhaseOutputBytes': 65536}}

def main(argv):
    assert len(argv) in [1, 3] and argv[0] in ['--run-remaining-once', '--execute-remaining-once']
    dispatch = json.loads((HERE / 'continuation-dispatch.json').read_bytes())
    value = json.loads(pin(dispatch['input']))
    assert value['ready'] is True, 'FRESH_FACTS_AND_FOUR_REPORTS_REQUIRED'
    inherited = json.loads(pin(dispatch['inheritedDispatch']))
    effective = {item['path']: item for item in inherited['bindings']}
    effective.update({item['path']: item for item in dispatch['bindings']})
    for binding in effective.values(): pin(binding)
    assert dispatch['continuation']['path'] == str(BASE / 'maintenance-continuation.py')
    assert dispatch['outer']['path'] == str(BASE / 'maintenance-supervise.py')
    pin(dispatch['continuation']); pin(dispatch['outer']); pin(dispatch['supervisor'])
    if argv[0] == '--execute-remaining-once':
        assert len(argv) == 3
        wall_deadline = int(argv[1]); deadline = float(argv[2])
        assert 0 < deadline - time.monotonic() <= 900
        assembled = compile_plan(value, dispatch['input']['path'], dispatch['input']['sha256'], wall_deadline)
        continuation = load(dispatch['continuation']['path'], 'held_recovery_continuation')
        continuation.execute(WINDOW, deadline, plan=assembled,
            verify=lambda: {'supervisor': dispatch['supervisor']}, validate=lambda: None)
        return 0
    assert len(argv) == 1
    # Parent fixes this namespace in the reviewed dispatch; no rerun/alternate name option.
    outer_path = HERE / 'actual-held-continuation-once.json'
    fd = os.open(outer_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        outer = load(dispatch['outer']['path'], 'held_recovery_outer')
        env = {'PATH': str(Path(NODE).parent) + ':/usr/bin:/bin:/usr/sbin', 'LC_ALL': 'C', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}
        result = outer.supervise_operator(outer.supervisor(), [PYTHON, str(HERE / 'run.py'), '--execute-remaining-once', str(int(time.time() * 1000) + 900000)], str(HERE), env)
        json.dump(result, stream); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    print(json.dumps({'exit': result['exit_code'], 'firstFailure': result['first_failure'], 'owned': result['owned_state'], 'eof': result['eof'], 'services': 'Independent phase/boot evidence required'}))
    return 0 if result['exit_code'] == 0 and result['first_failure'] is None and result['owned_state'] == 'absent' and all(result['eof'].values()) else 1

if __name__ == '__main__':
    try: raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        print(json.dumps({'outcome': 'UNKNOWN_KEEP_NO_RETRY', 'type': type(error).__name__}), file=sys.stderr)
        raise SystemExit(1)
