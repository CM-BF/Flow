"""Fixed successor parameters for the existing build supervisor; old once stays consumed."""
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent

def main(argv):
    if argv != ['--execute-fixed-recovery-r2-build']:
        raise ValueError('EXACT_RECOVERY_R2_BUILD_ARGUMENT_REQUIRED')
    spec = importlib.util.spec_from_file_location('svc06b_existing_build', HERE / 'build-supervise.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    (HERE / 'recovery-build-r2-once').mkdir(mode=0o700)
    return module.main(argv, inputs_path=HERE / 'recovery-build-r2-inputs.json',
        entry_path=HERE / 'recovery-build-r2-entry.mjs', output_path=HERE / 'recovery-build-r2-once/outer-report.json',
        argument='--execute-fixed-recovery-r2-build')

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
