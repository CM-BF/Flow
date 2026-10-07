"""One bounded observation through OPS-METER01, without contents or deletion authority."""
from dataclasses import asdict
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True

def main(argv):
    if len(argv) != 1:
        raise ValueError('EXACT_INPUT_REQUIRED')
    path = Path(argv[0])
    if not str(path).startswith('/private/tmp/flow-svc09a-host-') or path.name != 'input.json':
        raise ValueError('OWN_INPUT_REQUIRED')
    value = json.loads(path.read_bytes())
    pin = value['measurementModule']
    source = Path(pin['path'])
    assert str(source.resolve()) == pin['realpath']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == pin['sha256']
    spec = importlib.util.spec_from_file_location('svc09a_ops_meter', source)
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
    root = module.Root(value['directory'], int(value['directoryIdentity']['dev']), int(value['directoryIdentity']['ino']))
    measured = module.measure(root, exclude=('backend-artifacts',), limits=module.Limits(4096, .25))
    print(json.dumps(asdict(measured)))

if __name__ == '__main__':
    main(sys.argv[1:])
