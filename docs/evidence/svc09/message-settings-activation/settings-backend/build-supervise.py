"""One trusted source selection; the existing SVC09/OPS14 supervisor owns execution."""
import hashlib, importlib.util, json, sys
from pathlib import Path
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent

def main(argv):
    if argv != ['--execute-settings-build-once']:
        raise ValueError('EXACT_SETTINGS_BUILD_ARGUMENT_REQUIRED')
    manifest = json.loads((HERE / 'build-preparation.json').read_bytes())
    binding = manifest['sharedSupervisor']
    path = HERE.parent / 'host-integration/build/supervise.py'
    assert str(path.resolve()) == binding['path']
    raw = path.read_bytes()
    assert len(raw) == binding['bytes'] and hashlib.sha256(raw).hexdigest() == binding['sha256']
    spec = importlib.util.spec_from_file_location('svc09_settings_build', path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module.main(argv, settings=HERE)

if __name__ == '__main__': raise SystemExit(main(sys.argv[1:]))
