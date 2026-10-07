"""One fixed invocation of the existing build/OPS14 assembly. Import does not execute."""
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent

def main(argv):
    if argv != ['--execute-fixed-recovery-build']:
        raise ValueError('EXACT_RECOVERY_BUILD_ARGUMENT_REQUIRED')
    spec = importlib.util.spec_from_file_location('svc06b_existing_build', HERE / 'build-supervise.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # The existing old build namespace is never reused, including after failure.
    (HERE / 'recovery-build-once').mkdir(mode=0o700)
    return module.main(argv, inputs_path=HERE / 'recovery-build-inputs.json',
        entry_path=HERE / 'recovery-build-entry.mjs', output_path=HERE / 'recovery-build-once/outer-report.json',
        argument='--execute-fixed-recovery-build')

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
