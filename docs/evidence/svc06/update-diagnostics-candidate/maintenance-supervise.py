"""One independent OPS14 deadline around the whole procedural operator, never a service group."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
PYTHON = '/opt/homebrew/opt/python@3.13/bin/python3.13'
MODULE = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py'
MODULE_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'


def supervisor():
    # Fixed trusted module admission precedes launching any operator or personal access.
    assert hashlib.sha256(Path(MODULE).read_bytes()).hexdigest() == MODULE_SHA
    spec = importlib.util.spec_from_file_location('svc06_outer_ops14', MODULE)
    ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
    return ops


def supervise_operator(ops, argv, cwd, env, seconds=900):
    deadline = time.monotonic() + seconds
    report = ops.supervise(ops.Launch(tuple([*argv, str(deadline)]), cwd, env, ops.Ownership.CHILD_PID_ONLY),
                           ops.Policy(seconds, 0, 2, 65536))
    result = dict(vars(report))
    result['stdout'] = report.stdout.decode('utf8', 'replace'); result['stderr'] = report.stderr.decode('utf8', 'replace')
    result['deadlineScope'] = 'Entire operator from launch: bindings, filesystem gates, phase supervision, all save/fsync'
    result['maintenanceConsumers'] = 'Each inner OPS14 launch has its own session. Only each saved phase Report proves its termination; missing report means UNKNOWN/KEEP.'
    result['personalServices'] = 'Not owned or signalled by this outer supervisor; only original public maintenance acts on nonce-bound roles.'
    return result


if __name__ == '__main__':
    assert len(sys.argv) == 3 and sys.argv[1] == '--execute-fixed-maintenance'
    assert sys.argv[2].startswith('svc06-personal-7d1-')
    ops = supervisor()
    env = {'PATH': '/opt/homebrew/Cellar/node@24/24.20.0/bin:/usr/bin:/bin:/usr/sbin', 'LC_ALL': 'C',
           'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}
    result = supervise_operator(ops, [PYTHON, str(BASE / 'maintenance-continuation.py'), '--supervised-entry', sys.argv[2]], str(BASE), env)
    # Stop decisions never wait for report persistence. Actual caller redirects this bounded
    # raw JSON to a fresh exclusive 0600 file; absent outer != absent inner/service groups.
    print(json.dumps(result), flush=True)
    sys.exit(0 if result['exit_code'] == 0 and result['first_failure'] is None and result['owned_state'] == 'absent' and all(result['eof'].values()) else 1)
