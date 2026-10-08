"""Trusted R4 names only; the existing fixed caller retains admission and supervision."""
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('tui_fixed_caller', Path(__file__).with_name('r2-run.py'))
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)
R4 = caller.RunSpec('--run-r4-once', 'flow-tui01f04-20261008-r4',
    'r4-inputs.json', 'r4-permit.json', 'r4-actual-once', 'TUI01F04-REAL-HANDOFF-R4-ONCE',
    ('apps/tui/src/task-controls/fixture.ts', 'apps/tui/src/task-controls/fixture-process.ts',
     'experiments/tui-web-control-handoff/journey.ts', 'experiments/tui-web-control-handoff/preview.ts',
     'experiments/tui-web-control-handoff/terminal.py'))


def main(argv):
    return caller.main(argv, R4)


if __name__ == '__main__':
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        print(caller.json.dumps({'errorType': type(error).__name__, 'outcome': 'UNKNOWN_KEEP_NO_RETRY'}))
        raise SystemExit(1)
