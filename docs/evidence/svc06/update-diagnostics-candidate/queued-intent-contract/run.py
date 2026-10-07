"""Fixed seven calls, reusing the reviewed procedural executor and whole-operator supervisor."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec); sys.modules[name] = value; spec.loader.exec_module(value)
    return value

def load_plan():
    delta = json.loads((BASE / 'plan.json').read_bytes())
    raw = Path(delta['inherited']['path']).read_bytes(); assert hashlib.sha256(raw).hexdigest() == delta['inherited']['sha256']
    inherited = json.loads(raw)
    raw = Path(inherited['inputs']['path']).read_bytes(); assert hashlib.sha256(raw).hexdigest() == inherited['inputs']['sha256']
    inputs = json.loads(raw)
    plan = {**inherited, **delta, 'planPath': str(BASE / 'plan.json'), 'budget': {**inherited['budget'], 'freshBytes': delta['freshBytes']}}
    plan['fixedPins'] = [*inputs['runtimePins'], *inherited['observerPins'], inherited['factsReaderPin'], *delta['deltaPins']]
    node = plan['node']; installed = str(Path(plan['directory']) / 'backend-artifacts' / plan['artifact']['artifactId'] / 'root')
    plan['steps'] = []
    for name in ['fresh', 'hold-stop', 'retire', 'refresh', 'paused', 'resume', 'final']:
        root = installed if name in ['refresh', 'resume'] else plan['repository']
        argv = [node, '--import', root + '/node_modules/tsx/dist/loader.mjs']
        if name in ['refresh', 'resume']:
            argv += [root + '/tools/personal-preview/maintenance-host.mjs', name, plan['directory'], plan['artifact']['sourceHead'] if name == 'refresh' else '', '']
        else:
            argv += [str(BASE / 'caller.mjs'), name, plan['runDirectory']]
        plan['steps'].append({'name': name, 'argv': argv, 'cwd': root, 'ownership': 'childPidOnly', 'maximumWorkSeconds': 900 if name == 'refresh' else 60})
    return plan, inputs

def verify(plan, inputs):
    for pin in plan['fixedPins']:
        path = Path(pin['path']); before = path.lstat()
        assert stat.S_ISREG(before.st_mode) and not path.is_symlink() and str(path.resolve()) == pin['realpath']
        for key, value in [('dev', before.st_dev), ('ino', before.st_ino), ('uid', before.st_uid), ('nlink', before.st_nlink), ('bytes', before.st_size)]: assert str(value) == str(pin[key])
        raw = path.read_bytes(); after = path.lstat()
        assert (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns)
        assert hashlib.sha256(raw).hexdigest() == pin['sha256']
    for pin in plan['baselines']:
        raw = Path(pin['path']).read_bytes(); assert len(raw) == pin['bytes'] and hashlib.sha256(raw).hexdigest() == pin['sha256']
    return inputs

def validate(plan):
    assert [step['name'] for step in plan['steps']] == ['fresh', 'hold-stop', 'retire', 'refresh', 'paused', 'resume', 'final']
    assert all(step['ownership'] == 'childPidOnly' and step['argv'][0] == plan['node'] for step in plan['steps'])
    assert all(not any(word in step['argv'] for word in ['bootstrap', 'migrate', 'replace-host', 'publish']) for step in plan['steps'])
    assert plan['request']['operationId'] == 'e6550b3c-1f67-4c2c-869d-e84d5e838113' and plan['request']['holdVersion'] == 20
    assert plan['request']['confirmation']['protocol'] == 'flow.intent-preserved-queued.v2'
    return {'outcome': 'fixed-seven-calls-available', 'steps': plan['steps'], 'personalIO': 0}

if __name__ == '__main__':
    plan, inputs = load_plan()
    if sys.argv[1:] == ['--check-invocations']:
        print(json.dumps(validate(plan)))
    elif len(sys.argv) == 3 and sys.argv[1] == '--execute-fixed-maintenance':
        validate(plan)
        outerPin = next(pin for pin in plan['deltaPins'] if pin['path'] == str(BASE.parent / 'maintenance-supervise.py'))
        assert hashlib.sha256(Path(outerPin['path']).read_bytes()).hexdigest() == outerPin['sha256']
        outer = module('svc06_reused_outer', BASE.parent / 'maintenance-supervise.py')
        ops = outer.supervisor()
        env = {'PATH': str(Path(plan['node']).parent) + ':/usr/bin:/bin:/usr/sbin', 'LC_ALL': 'C', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}
        result = outer.supervise_operator(ops, [outer.PYTHON, str(Path(__file__).resolve()), '--supervised-entry', sys.argv[2]], str(BASE), env)
        print(json.dumps(result), flush=True)
        sys.exit(0 if result['exit_code'] == 0 and result['first_failure'] is None and result['owned_state'] == 'absent' and all(result['eof'].values()) else 1)
    elif len(sys.argv) == 4 and sys.argv[1] == '--supervised-entry':
        executor = module('svc06_reused_executor', BASE.parent / 'maintenance-continuation.py')
        executor.execute(sys.argv[2], float(sys.argv[3]), plan=plan, verify=lambda: verify(plan, inputs), validate=lambda: validate(plan))
    else:
        raise SystemExit('EXACT_INVOCATION_REQUIRED')
