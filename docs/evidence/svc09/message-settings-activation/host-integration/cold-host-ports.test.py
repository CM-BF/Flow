"""Pure consumers only: no Pool, subprocess, service, or private input."""
import ast, importlib.util, sys
from pathlib import Path
from types import SimpleNamespace
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
def load(name):
    path = HERE / (name + '.py'); ast.parse(path.read_text())
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module
run, outer = load('host-run'), load('host-supervise')
purpose = 'SVC06B_FIXED_ARTIFACT_COLD_THREE_ROLE'
calls = []
def child(argv, *limits):
    calls.append((argv, limits))
    return SimpleNamespace(pid=123, ownership='newChildSession', stdout=b'', stderr=b'', exit_code=0,
      owned_state='absent', eof={'stdout':True,'stderr':True}, first_failure=None)
result = {}
run.work_and_cleanup(child, ['fixed-node'], Path('/synthetic/ns'), Path('/synthetic/private'), result,
    write=lambda *args: None, purpose=purpose, entries=['/fixed/work.mjs','/fixed/cleanup.mjs'])
assert [value[0][1] for value in calls] == ['/fixed/work.mjs','/fixed/cleanup.mjs']
assert [value[0][2] for value in calls] == ['--work-once','--cleanup-once']
assert calls[0][1] == (180,32,131072) and calls[1][1] == (30,2,131072)
assert result['complete'] is True
print('PASS explicit cold entries reuse original work/cleanup limits (synthetic child reports)')
for module in (run, outer):
    try: module.main([], attempt={})
    except AssertionError: pass
    else: raise AssertionError('unbound attempt accepted')
print('PASS both trusted attempt ports reject incomplete metadata before I/O')
assert run.attempt_files(['--execute-default-host-once']) == ('actual-default-host-once','default-host-preparation.json')
assert outer.attempt_files(['--run-default-host-once']) == ('default-host-outer-once','actual-default-host-once','--execute-default-host-once')
try: run.work_and_cleanup(child, [], Path('/x'), Path('/y'), {}, purpose=purpose)
except AssertionError: pass
else: raise AssertionError('cold entry fallback accepted')
print('PASS old default once namespaces unchanged and cold entry fallback rejected')
