"""Trusted fixed successor parameters; lifecycle stays in the original cold caller."""
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('svc06b_cold_shared', Path(__file__).with_name('recovery-cold-run.py'))
caller = importlib.util.module_from_spec(spec); spec.loader.exec_module(caller)

def main(argv):
    return caller.main(argv, attempt={'stem': 'recovery-cold-r2', 'sourceHead': '880060a317cd99f3f29b41333f6dd7d7f5ab1488'})

if __name__ == '__main__':
    try: raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        print(json.dumps({'errorType': type(error).__name__, 'disposition': 'UNKNOWN_KEEP_NO_RETRY'}))
        raise SystemExit(1)
