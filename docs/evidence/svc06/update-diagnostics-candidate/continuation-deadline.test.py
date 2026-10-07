"""Only self-owned toy children; no installation I/O, phase entry or personal service."""
import importlib.util
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, BASE / filename)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module


outer = load('continuation_outer_test', 'maintenance-supervise.py')
entry = load('continuation_entry_test', 'maintenance-continuation.py')
ops = outer.supervisor()
env = {'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'}
# A blocked operator (representing bindings/save/fsync) cannot postpone the outer stop.
report = outer.supervise_operator(ops, [sys.executable, '-c', 'import time; time.sleep(30)'], str(BASE), env, 0.1)
assert report['first_failure'] is not None and report['owned_state'] == 'absent' and all(report['eof'].values())
assert report['ownership'] == 'childPidOnly' and report['elapsed_ms'] < 2500
assert 'UNKNOWN/KEEP' in report['maintenanceConsumers']
assert 'Not owned or signalled' in report['personalServices']
print('PASS whole-operator blocking bounded independently; no detached-group claim')
# The real entry recomputes after persistence and keeps room for inner reap/outer stop.
deadline = time.monotonic() + 7.04
assert 0 < entry.phase_budget({'maximumWorkSeconds': 900}, deadline) <= 0.04
time.sleep(0.06)
try:
    entry.phase_budget({'maximumWorkSeconds': 900}, deadline)
    raise AssertionError('late phase was admitted')
except AssertionError as error:
    assert str(error) == 'SHARED_DEADLINE_EXPIRED'
print('PASS expired allowance refuses launch after simulated persistence delay')
