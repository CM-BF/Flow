"""Fixed calls into the existing cold fixture operator/OPS14 supervisor; no new lifecycle."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
PURPOSE = 'SVC06B_FIXED_ARTIFACT_COLD_THREE_ROLE'

def fixed_bytes(pin):
    path = Path(pin['path'])
    assert path.is_absolute() and not path.is_symlink() and str(path.resolve()) == pin['realpath']
    data = path.read_bytes()
    assert len(data) == pin['bytes'] and hashlib.sha256(data).hexdigest() == pin['sha256']
    return data

def load(pin, name):
    fixed_bytes(pin)
    spec = importlib.util.spec_from_file_location(name, pin['path'])
    value = importlib.util.module_from_spec(spec); sys.modules[name] = value; spec.loader.exec_module(value)
    return value

def main(argv):
    if argv not in (['--run-fixed-cold-once'], ['--execute-cold-once']):
        raise ValueError('EXACT_FIXED_COLD_ARGUMENT_REQUIRED')
    # This file is fixed only after the real recovery artifact is available.
    dispatch = json.loads((HERE / 'recovery-cold-dispatch.json').read_bytes())
    assert dispatch['purpose'] == PURPOSE
    fixed = json.loads(fixed_bytes(dispatch['input']))
    assert fixed['sourceHead'] == 'f37a3612068c7215994750574a7451ede841bcce'
    assert Path(dispatch['input']['path']) == HERE / 'recovery-cold-inputs.json'
    assert Path(dispatch['preparation']['path']) == HERE / 'recovery-cold-preparation.json'
    assert Path(dispatch['operator']['path']) == Path(__file__).resolve()
    fixed_bytes(dispatch['preparation']); fixed_bytes(dispatch['operator'])
    if argv == ['--execute-cold-once']:
        operator = load(dispatch['workHelper'], 'svc06b_fixed_cold_work')
        return operator.main([], attempt={'input': dispatch['input'], 'preparation': dispatch['preparation'],
            'namespace': str(HERE / 'recovery-cold-once'),
            'entries': [str(HERE / 'recovery-cold-entry.mjs')] * 2})
    supervisor = load(dispatch['outerHelper'], 'svc06b_fixed_cold_outer')
    return supervisor.main([], attempt={'input': dispatch['input'], 'operator': dispatch['operator'],
        'argument': '--execute-cold-once', 'directory': str(HERE),
        'outerName': 'recovery-cold-outer-once', 'operatorName': 'recovery-cold-once'})

if __name__ == '__main__':
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        print(json.dumps({'errorType': type(error).__name__, 'disposition': 'UNKNOWN_KEEP_NO_RETRY'}))
        raise SystemExit(1)
