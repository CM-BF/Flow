"""Trusted R3 names only; the existing fixed caller retains admission and supervision."""
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('tui_fixed_caller', Path(__file__).with_name('r2-run.py'))
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)
R3 = caller.RunSpec('--run-r3-once', 'flow-tui01f04-20261008-r3',
    'r3-inputs.json', 'r3-permit.json', 'r3-actual-once', 'TUI01F04-REAL-HANDOFF-R3-ONCE')


def main(argv):
    return caller.main(argv, R3)


if __name__ == '__main__':
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        print(caller.json.dumps({'errorType': type(error).__name__, 'outcome': 'UNKNOWN_KEEP_NO_RETRY'}))
        raise SystemExit(1)
